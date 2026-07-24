/** Statuses that occupy a place in the waitlist queue (ordered). */
export const QUEUE_STATUSES = ["waiting", "offered"];

/** Ad statuses that occupy a paid zip slot (mirrors api/_lib/stripeHelpers). */
export const SLOT_HOLDING_STATUSES = [
  "active",
  "pending_payment",
  "pending_review",
  "flagged",
  "past_due",
];

/**
 * Sort for admin / queue display:
 * active queue first (position ASC, then joined ASC), then inactive by newest update.
 */
export function compareWaitlistEntries(a, b) {
  const aQ = QUEUE_STATUSES.includes(a.status);
  const bQ = QUEUE_STATUSES.includes(b.status);
  if (aQ && !bQ) return -1;
  if (!aQ && bQ) return 1;
  if (aQ && bQ) {
    const posDiff = Number(a.position || 0) - Number(b.position || 0);
    if (posDiff !== 0) return posDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  }
  return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
}

/** Next position = count of waiting + offered for the zip, plus one. */
export async function nextPositionForZip(client, zip) {
  const { count, error } = await client
    .from("ad_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("zip_code", zip)
    .in("status", QUEUE_STATUSES);
  if (error) throw error;
  return (count || 0) + 1;
}

/**
 * Rewrite position to 1..n for waiting+offered in a zip (by current position, then created_at).
 * Heals duplicate #1 rows from the old join logic.
 */
export async function renumberZipQueue(client, zip) {
  const { data, error } = await client
    .from("ad_waitlist")
    .select("id, position, status, created_at")
    .eq("zip_code", zip)
    .in("status", QUEUE_STATUSES);
  if (error) throw error;

  const sorted = [...(data || [])].sort((a, b) => {
    const posDiff = Number(a.position || 0) - Number(b.position || 0);
    if (posDiff !== 0) return posDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  for (let i = 0; i < sorted.length; i++) {
    const nextPos = i + 1;
    if (Number(sorted[i].position) === nextPos) continue;
    const { error: updateErr } = await client
      .from("ad_waitlist")
      .update({ position: nextPos, updated_at: new Date().toISOString() })
      .eq("id", sorted[i].id);
    if (updateErr) throw updateErr;
  }

  return sorted.length;
}

function isOfferStillActive(entry, now = Date.now()) {
  if (!entry?.offer_expires_date) return false;
  return new Date(entry.offer_expires_date).getTime() > now;
}

/**
 * Open ad slots for a zip = max_slots − holding ads − non-expired waitlist offers.
 * Active offers reserve capacity so a random new ad can't snatch the offered spot.
 * Pass ignoreWaitlistEntryId when the claimant is redeeming their own offer.
 */
export async function countOpenAdSlots(client, zip, { ignoreWaitlistEntryId = null } = {}) {
  const [{ data: zipConfig }, { data: holding }, { data: offers }] = await Promise.all([
    client.from("ad_zip_config").select("max_slots").eq("zip_code", zip).maybeSingle(),
    client.from("banner_ads").select("id").eq("zip_code", zip).in("status", SLOT_HOLDING_STATUSES),
    client
      .from("ad_waitlist")
      .select("id, offer_expires_date")
      .eq("zip_code", zip)
      .eq("status", "offered"),
  ]);

  const maxSlots = Number(zipConfig?.max_slots) || 3;
  const holdingCount = (holding || []).length;
  const now = Date.now();
  const reservedOffers = (offers || []).filter((o) => {
    if (ignoreWaitlistEntryId && o.id === ignoreWaitlistEntryId) return false;
    return isOfferStillActive(o, now);
  }).length;

  return {
    maxSlots,
    holding: holdingCount,
    reservedOffers,
    open: Math.max(0, maxSlots - holdingCount - reservedOffers),
  };
}
