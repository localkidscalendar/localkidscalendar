import { createAdminClient, requireUser, getEnv } from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";

const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);

function isAuthorizedCron(req) {
  const cronSecret = getEnv("CRON_SECRET");
  const auth = req.headers.authorization || "";
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  // Vercel also sets x-vercel-cron: 1 on scheduled invocations.
  if (req.headers["x-vercel-cron"] === "1") return true;
  return false;
}

async function isAdminCaller(req) {
  const { user, error } = await requireUser(req);
  if (error || !user) return false;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();
  const email = (profile?.email || user.email || "").trim().toLowerCase();
  return profile?.role === "admin" || ADMIN_EMAILS.has(email);
}

/**
 * Expire stale waitlist offers and advance the next waiter when a slot is open.
 * Invoked by Vercel Cron and optionally by admins (manual run).
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cronOk = isAuthorizedCron(req);
    const adminOk = cronOk ? false : await isAdminCaller(req);
    if (!cronOk && !adminOk) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const admin = createAdminClient();
    const result = await runProcessWaitlist(admin);
    console.log("process-waitlist:", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("process-waitlist error:", error);
    return res.status(500).json({ error: error.message || "Failed to process waitlist" });
  }
}
