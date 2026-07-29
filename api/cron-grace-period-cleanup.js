import { createAdminClient, getEnv } from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";
import { GRACE_PERIOD_DAYS } from "./_lib/adBillingNotices.js";

/**
 * Daily cron: expire past_due ads after the 7-day grace period and advance waitlist.
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
    const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: pastDueAds, error } = await admin
      .from("banner_ads")
      .select("id, user_id, zip_code, business_name, grace_period_start, stripe_subscription_id")
      .eq("status", "past_due")
      .not("grace_period_start", "is", null)
      .lte("grace_period_start", cutoff)
      .limit(200);
    if (error) throw error;

    let expired = 0;
    for (const ad of pastDueAds || []) {
      const { error: updateErr } = await admin
        .from("banner_ads")
        .update({
          status: "expired",
          auto_renew: false,
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", ad.id);
      if (updateErr) {
        console.error(`cron-grace-period-cleanup: failed to expire ad ${ad.id}:`, updateErr.message);
        continue;
      }
      expired += 1;
      console.log(`cron-grace-period-cleanup: expired ad ${ad.id} (zip ${ad.zip_code})`);
    }

    let waitlist = null;
    if (expired > 0) {
      try {
        waitlist = await runProcessWaitlist(admin);
      } catch (err) {
        console.error("cron-grace-period-cleanup: processWaitlist failed:", err.message);
      }
    }

    return res.status(200).json({
      ok: true,
      checked: (pastDueAds || []).length,
      expired,
      waitlist,
    });
  } catch (err) {
    console.error("cron-grace-period-cleanup failed:", err);
    return res.status(500).json({ error: err.message || "Failed" });
  }
}
