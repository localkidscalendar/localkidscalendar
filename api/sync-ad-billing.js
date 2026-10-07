import Stripe from "stripe";
import { getEnv, createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import { applyStripeSubscriptionToAd } from "./_lib/syncAdSubscription.js";
import { daysUntilDate, renewalDeadline } from "../shared/adRenewalPolicy.js";

/**
 * Refresh banner_ads plan dates from Stripe for the signed-in supporter.
 * Repairs stale next_renewal_date after renewals when webhooks lagged or failed.
 * By default only syncs ads whose stored renewal date is in the past (or forced).
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
    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return res.status(500).json({ error: "Server missing STRIPE_SECRET_KEY" });
    }

    const { user: authUser, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const { ad_id: adId, force } = req.body || {};
    const admin = createAdminClient();

    let query = admin
      .from("banner_ads")
      .select(
        "id, user_id, status, stripe_subscription_id, next_renewal_date, plan_end_date, plan_start_date, auto_renew"
      )
      .eq("user_id", authUser.id)
      .not("stripe_subscription_id", "is", null)
      .in("status", ["active", "past_due", "flagged"]);

    if (adId) query = query.eq("id", adId);

    const { data: ads, error: adsError } = await query;
    if (adsError) throw adsError;

    const stripe = new Stripe(stripeSecret);
    const synced = [];

    for (const ad of ads || []) {
      const daysLeft = daysUntilDate(renewalDeadline(ad));
      const needsSync = force === true || daysLeft === null || daysLeft < 0;
      if (!needsSync) continue;

      try {
        const subscription = await stripe.subscriptions.retrieve(ad.stripe_subscription_id);
        if (subscription.status === "canceled") continue;
        const updates = await applyStripeSubscriptionToAd(admin, ad.id, subscription, {
          includeAutoRenew: true,
        });
        if (updates) {
          synced.push({ id: ad.id, ...updates });
        }
      } catch (err) {
        console.error(`sync-ad-billing: failed for ad ${ad.id}:`, err.message);
      }
    }

    return res.status(200).json({ success: true, synced_count: synced.length, synced });
  } catch (error) {
    console.error("sync-ad-billing error:", error);
    return res.status(500).json({ error: error.message || "Failed to sync ad billing" });
  }
}
