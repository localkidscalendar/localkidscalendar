import { createAdminClient, getEnv } from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";

/**
 * Vercel Cron entrypoint ONLY.
 * When a path is listed in vercel.json crons and CRON_SECRET is set, Vercel
 * rejects requests whose Authorization bearer is not that secret (including
 * admin JWTs). Keep this route cron-only; admins use /api/process-waitlist.
 */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = getEnv("CRON_SECRET");
  const auth = req.headers.authorization || "";
  const cronHeader = req.headers["x-vercel-cron"] === "1";
  const bearerOk = cronSecret && auth === `Bearer ${cronSecret}`;

  if (!bearerOk && !cronHeader) {
    return res.status(401).json({ error: "Unauthorized — cron secret required" });
  }

  try {
    const admin = createAdminClient();
    const result = await runProcessWaitlist(admin);
    console.log("cron-process-waitlist:", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("cron-process-waitlist error:", error);
    return res.status(500).json({ error: error.message || "Failed to process waitlist" });
  }
}
