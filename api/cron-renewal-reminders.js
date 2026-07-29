import { createAdminClient, getEnv } from "./_lib/stripeHelpers.js";
import {
  RENEWAL_REMINDER_DAYS,
  notifySubscriptionRenewingSoon,
} from "./_lib/adBillingNotices.js";

/**
 * Daily cron: send in-app "renewing soon" messages for ads ~21 days from renewal.
 * Dedupes by checking for an existing unread/read message with the same template + renewal date.
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
    const now = new Date();
    const windowStart = new Date(now.getTime() + (RENEWAL_REMINDER_DAYS - 0.5) * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (RENEWAL_REMINDER_DAYS + 0.5) * 24 * 60 * 60 * 1000);

    const { data: ads, error } = await admin
      .from("banner_ads")
      .select("id, user_id, zip_code, business_name, next_renewal_date, auto_renew, status")
      .eq("status", "active")
      .eq("auto_renew", true)
      .not("next_renewal_date", "is", null)
      .gte("next_renewal_date", windowStart.toISOString().slice(0, 10))
      .lte("next_renewal_date", windowEnd.toISOString().slice(0, 10))
      .limit(200);
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    for (const ad of ads || []) {
      const renewalKey = String(ad.next_renewal_date).slice(0, 10);
      const { data: existing } = await admin
        .from("user_messages")
        .select("id")
        .eq("user_id", ad.user_id)
        .eq("template_key", "subscription_renewing_soon")
        .eq("related_id", ad.id)
        .contains("metadata", { next_renewal_date: ad.next_renewal_date })
        .limit(1)
        .maybeSingle();

      // Fallback if contains filter isn't available / mismatched shape
      let alreadySent = Boolean(existing?.id);
      if (!alreadySent) {
        const { data: recent } = await admin
          .from("user_messages")
          .select("id, metadata")
          .eq("user_id", ad.user_id)
          .eq("template_key", "subscription_renewing_soon")
          .eq("related_id", ad.id)
          .limit(5);
        alreadySent = (recent || []).some((m) => {
          const metaDate = m.metadata?.next_renewal_date;
          return metaDate && String(metaDate).slice(0, 10) === renewalKey;
        });
      }

      if (alreadySent) {
        skipped += 1;
        continue;
      }

      try {
        await notifySubscriptionRenewingSoon(admin, ad);
        sent += 1;
      } catch (err) {
        console.error(`cron-renewal-reminders: failed for ad ${ad.id}:`, err.message);
      }
    }

    return res.status(200).json({ ok: true, candidates: (ads || []).length, sent, skipped });
  } catch (err) {
    console.error("cron-renewal-reminders failed:", err);
    return res.status(500).json({ error: err.message || "Failed" });
  }
}
