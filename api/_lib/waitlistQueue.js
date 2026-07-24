import { SLOT_HOLDING_STATUSES } from "./stripeHelpers.js";

export const QUEUE_STATUSES = ["waiting", "offered"];

function isOfferStillActive(entry, now = Date.now()) {
  if (!entry?.offer_expires_date) return false;
  return new Date(entry.offer_expires_date).getTime() > now;
}

/** Next queue position for a zip (waiting + offered). */
export async function nextPositionForZip(admin, zip) {
  const { count, error } = await admin
    .from("ad_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("zip_code", zip)
    .in("status", QUEUE_STATUSES);
  if (error) throw error;
  return (count || 0) + 1;
}

/** Rewrite positions 1..n for waiting+offered in a zip. */
export async function renumberZipQueue(admin, zip) {
  const { data, error } = await admin
    .from("ad_waitlist")
    .select("id, position, created_at")
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
    const { error: updateErr } = await admin
      .from("ad_waitlist")
      .update({ position: nextPos, updated_at: new Date().toISOString() })
      .eq("id", sorted[i].id);
    if (updateErr) throw updateErr;
  }
}

/**
 * Open slots = max − holding ads − active (non-expired) waitlist offers.
 * Pass ignoreWaitlistEntryId when the claimant is redeeming their own offer.
 */
export async function countOpenAdSlots(admin, zip, { ignoreWaitlistEntryId = null } = {}) {
  const [{ data: zipConfig }, { data: holding }, { data: offers }] = await Promise.all([
    admin.from("ad_zip_config").select("max_slots").eq("zip_code", zip).maybeSingle(),
    admin.from("banner_ads").select("id").eq("zip_code", zip).in("status", SLOT_HOLDING_STATUSES),
    admin
      .from("ad_waitlist")
      .select("id, offer_expires_date")
      .eq("zip_code", zip)
      .eq("status", "offered"),
  ]);

  const maxSlots = Number(zipConfig?.max_slots) || 3;
  const now = Date.now();
  const reservedOffers = (offers || []).filter((o) => {
    if (ignoreWaitlistEntryId && o.id === ignoreWaitlistEntryId) return false;
    return isOfferStillActive(o, now);
  }).length;

  return {
    maxSlots,
    holding: (holding || []).length,
    reservedOffers,
    open: Math.max(0, maxSlots - (holding || []).length - reservedOffers),
  };
}
