import { createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import { SLOT_HOLDING_STATUSES } from "./_lib/stripeHelpers.js";
import { sendOfferEmailForEntry } from "./_lib/processWaitlistCore.js";

const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);
const OFFER_HOURS = 24;

/**
 * Admin-only: manually offer a waitlist spot (when a slot is already open) and email the user.
 * Does not bump offer_count — that increments only when an offer expires unclaimed (Base44 parity).
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", user.id)
      .maybeSingle();
    const email = (profile?.email || user.email || "").trim().toLowerCase();
    if (profile?.role !== "admin" && !ADMIN_EMAILS.has(email)) {
      return res.status(403).json({ error: "Forbidden — admin role required" });
    }

    const entryId = req.body?.waitlist_entry_id;
    if (!entryId) return res.status(400).json({ error: "waitlist_entry_id is required" });

    const { data: entry, error: entryErr } = await admin
      .from("ad_waitlist")
      .select("*")
      .eq("id", entryId)
      .maybeSingle();
    if (entryErr) throw entryErr;
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found" });
    if (entry.status !== "waiting") {
      return res.status(409).json({ error: `Entry status is "${entry.status}", expected "waiting"` });
    }

    const zip = entry.zip_code;
    const [{ data: zipConfig }, { data: holding }, { data: activeOffers }] = await Promise.all([
      admin.from("ad_zip_config").select("max_slots").eq("zip_code", zip).maybeSingle(),
      admin.from("banner_ads").select("id").eq("zip_code", zip).in("status", SLOT_HOLDING_STATUSES),
      admin
        .from("ad_waitlist")
        .select("id, offer_expires_date")
        .eq("zip_code", zip)
        .eq("status", "offered"),
    ]);

    const maxSlots = Number(zipConfig?.max_slots) || 3;
    const open = Math.max(0, maxSlots - (holding || []).length);
    if (open <= 0) {
      return res.status(409).json({
        error:
          "No open slot in this zip. Free a placement or raise max slots under Custom Zip Code Configurations first.",
      });
    }

    const now = new Date();
    const hasActiveOffer = (activeOffers || []).some(
      (e) => e.offer_expires_date && new Date(e.offer_expires_date) > now
    );
    if (hasActiveOffer) {
      return res.status(409).json({
        error: "An offer is already active for this zip. Wait for it to be claimed or expire.",
      });
    }

    const expires = new Date(now.getTime() + OFFER_HOURS * 60 * 60 * 1000);
    const notes = typeof req.body?.admin_override_notes === "string" ? req.body.admin_override_notes.trim() : "";

    const updated = {
      status: "offered",
      offer_sent_date: now.toISOString(),
      offer_expires_date: expires.toISOString(),
      updated_at: now.toISOString(),
      ...(notes ? { admin_override_notes: notes } : {}),
    };

    const { data: saved, error: updateErr } = await admin
      .from("ad_waitlist")
      .update(updated)
      .eq("id", entryId)
      .select("*")
      .single();
    if (updateErr) throw updateErr;

    let emailId = null;
    try {
      const result = await sendOfferEmailForEntry(saved);
      emailId = result.id;
    } catch (emailErr) {
      console.error("offer-waitlist-spot: email failed:", emailErr.message);
      return res.status(200).json({
        ok: true,
        entry: saved,
        email_sent: false,
        email_error: emailErr.message,
      });
    }

    return res.status(200).json({ ok: true, entry: saved, email_sent: true, email_id: emailId });
  } catch (error) {
    console.error("offer-waitlist-spot error:", error);
    return res.status(500).json({ error: error.message || "Failed to offer waitlist spot" });
  }
}
