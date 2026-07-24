import { createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";

const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);

/**
 * Admin-only waitlist processor (Expire / Run processor buttons).
 * Cron uses /api/cron-process-waitlist — do not list this path in vercel.json crons.
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
      return res.status(403).json({
        error: `Forbidden — admin role required (signed in as ${email || "unknown"}, role: ${profile?.role || "none"})`,
      });
    }

    const result = await runProcessWaitlist(admin);
    console.log("process-waitlist (admin):", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("process-waitlist error:", error);
    return res.status(500).json({ error: error.message || "Failed to process waitlist" });
  }
}
