import { createAdminClient, getEnv } from "./_lib/stripeHelpers.js";
import {
  frequenciesForToday,
  sendMatchingDigests,
} from "./_lib/sendNotificationDigestsCore.js";

/**
 * Vercel Cron entrypoint ONLY (8am PT schedule in vercel.json).
 * Keep separate from the admin JWT route — CRON_SECRET rejects admin tokens.
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
    const frequencies = frequenciesForToday();
    const result = await sendMatchingDigests(admin, { frequencies });
    console.log("cron-send-notification-emails:", { frequencies, ...result });
    return res.status(200).json({ ok: true, frequencies, ...result });
  } catch (error) {
    console.error("cron-send-notification-emails error:", error);
    return res.status(500).json({ error: error.message || "Failed to send digests" });
  }
}
