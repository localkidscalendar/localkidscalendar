import { SLOT_HOLDING_STATUSES } from "./stripeHelpers.js";
import { sendViaResend } from "./resendSend.js";
import { buildWaitlistOfferEmail } from "./waitlistEmail.js";

const OFFER_HOURS = 24;
const MAX_OFFER_ATTEMPTS = 3;

/**
 * Expire stale offers, then advance one new offer per zip with open capacity.
 * Mirrors Base44 processWaitlist. Uses SLOT_HOLDING_STATUSES for capacity
 * (aligned with Ad Manager / checkout) rather than active-only counting.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ sendEmail?: boolean }} [opts]
 */
export async function runProcessWaitlist(admin, opts = {}) {
  const sendEmail = opts.sendEmail !== false;
  const now = new Date();
  let expired = 0;
  let cancelled = 0;
  let offersSent = 0;
  const emailErrors = [];

  // ── Step 1: Expire outstanding offers past their deadline ───────────────
  const { data: offeredEntries, error: offeredErr } = await admin
    .from("ad_waitlist")
    .select("*")
    .eq("status", "offered");
  if (offeredErr) throw offeredErr;

  for (const entry of offeredEntries || []) {
    if (!entry.offer_expires_date || new Date(entry.offer_expires_date) >= now) continue;

    const offerCount = Number(entry.offer_count || 0) + 1;
    if (offerCount >= MAX_OFFER_ATTEMPTS) {
      const { error } = await admin
        .from("ad_waitlist")
        .update({
          status: "cancelled",
          offer_count: offerCount,
          updated_at: now.toISOString(),
        })
        .eq("id", entry.id);
      if (error) throw error;
      cancelled += 1;
    } else {
      const { data: waitingForZip } = await admin
        .from("ad_waitlist")
        .select("position")
        .eq("zip_code", entry.zip_code)
        .eq("status", "waiting");
      const maxPos = (waitingForZip || []).reduce(
        (max, w) => Math.max(max, Number(w.position || 0)),
        0
      );
      const { error } = await admin
        .from("ad_waitlist")
        .update({
          status: "waiting",
          offer_count: offerCount,
          position: maxPos + 1,
          offer_sent_date: null,
          offer_expires_date: null,
          updated_at: now.toISOString(),
        })
        .eq("id", entry.id);
      if (error) throw error;
      expired += 1;
    }
  }

  // ── Step 2: Capacity + waiting queues ───────────────────────────────────
  const [{ data: holdingAds }, { data: zipConfigs }, { data: currentWaiting }] =
    await Promise.all([
      admin.from("banner_ads").select("zip_code, status").in("status", SLOT_HOLDING_STATUSES),
      admin.from("ad_zip_config").select("zip_code, max_slots"),
      admin.from("ad_waitlist").select("*").eq("status", "waiting"),
    ]);

  const holdingByZip = {};
  for (const ad of holdingAds || []) {
    holdingByZip[ad.zip_code] = (holdingByZip[ad.zip_code] || 0) + 1;
  }

  const zipConfigMap = {};
  for (const cfg of zipConfigs || []) {
    zipConfigMap[cfg.zip_code] = Number(cfg.max_slots) || 3;
  }

  const waitingByZip = {};
  for (const entry of currentWaiting || []) {
    if (!waitingByZip[entry.zip_code]) waitingByZip[entry.zip_code] = [];
    waitingByZip[entry.zip_code].push(entry);
  }
  for (const zip of Object.keys(waitingByZip)) {
    waitingByZip[zip].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }

  // ── Step 3: Still-active offers (avoid double-offer per zip) ────────────
  const { data: stillOffered } = await admin
    .from("ad_waitlist")
    .select("zip_code, offer_expires_date")
    .eq("status", "offered");

  // ── Step 4: Offer one spot per zip with capacity ─────────────────────────
  for (const zip of Object.keys(waitingByZip)) {
    const maxSlots = zipConfigMap[zip] || 3;
    const holdingCount = holdingByZip[zip] || 0;
    if (maxSlots - holdingCount <= 0) continue;

    const hasActiveOffer = (stillOffered || []).some(
      (e) => e.zip_code === zip && e.offer_expires_date && new Date(e.offer_expires_date) > now
    );
    if (hasActiveOffer) continue;

    const next = waitingByZip[zip][0];
    if (!next) continue;

    const offerExpires = new Date(now.getTime() + OFFER_HOURS * 60 * 60 * 1000);
    const { error: updateErr } = await admin
      .from("ad_waitlist")
      .update({
        status: "offered",
        offer_sent_date: now.toISOString(),
        offer_expires_date: offerExpires.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", next.id);
    if (updateErr) throw updateErr;

    // Track so we don't double-offer this zip in the same run
    (stillOffered || []).push({ zip_code: zip, offer_expires_date: offerExpires.toISOString() });

    if (sendEmail && next.email) {
      try {
        const { subject, html } = buildWaitlistOfferEmail({
          business_name: next.business_name,
          zip_code: zip,
          offer_expires_date: offerExpires,
          offer_count: next.offer_count || 0,
        });
        await sendViaResend({ to: next.email, subject, html });
        offersSent += 1;
      } catch (err) {
        console.error(`processWaitlist: email failed for ${next.email}:`, err.message);
        emailErrors.push({ email: next.email, error: err.message });
      }
    } else {
      offersSent += 1;
    }
  }

  return { expired, cancelled, offers_sent: offersSent, email_errors: emailErrors };
}

/**
 * Send (or re-send) the offer email for an already-offered waitlist entry.
 */
export async function sendOfferEmailForEntry(entry) {
  if (!entry?.email) throw new Error("Waitlist entry has no email");
  const { subject, html } = buildWaitlistOfferEmail({
    business_name: entry.business_name,
    zip_code: entry.zip_code,
    offer_expires_date: entry.offer_expires_date,
    offer_count: entry.offer_count || 0,
  });
  return sendViaResend({ to: entry.email, subject, html });
}
