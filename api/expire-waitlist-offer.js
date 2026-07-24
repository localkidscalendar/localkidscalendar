import { createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import { renumberZipQueue } from "./_lib/waitlistQueue.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";

const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);

/**
 * Admin-only: force-expire one offered waitlist entry, then run the processor
 * so the next person can be offered (and emailed).
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
    if (entry.status !== "offered") {
      return res.status(409).json({ error: `Entry status is "${entry.status}", expected "offered"` });
    }

    const { error: updateErr } = await admin
      .from("ad_waitlist")
      .update({
        offer_expires_date: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);
    if (updateErr) throw updateErr;

    const result = await runProcessWaitlist(admin);
    try {
      await renumberZipQueue(admin, entry.zip_code);
    } catch {}

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("expire-waitlist-offer error:", error);
    return res.status(500).json({ error: error.message || "Failed to expire waitlist offer" });
  }
}
