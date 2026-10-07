import Stripe from "stripe";
import { getEnv, createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import { billingFieldsFromStripeSubscription } from "./_lib/syncAdSubscription.js";
import {
  daysUntilDate,
  effectiveBillingDates,
  renewalDeadline,
} from "../shared/adRenewalPolicy.js";

/**
 * Refresh banner_ads plan dates from Stripe for the signed-in supporter.
 * Repairs stale next_renewal_date after renewals when webhooks lagged or failed.
 * Falls back to anniversary roll-forward when Stripe is unavailable or still past.
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
        "id, user_id, status, plan_type, stripe_subscription_id, next_renewal_date, plan_end_date, plan_start_date, auto_renew"
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

      let candidate = {
        plan_start_date: ad.plan_start_date,
        plan_end_date: ad.plan_end_date,
        next_renewal_date: ad.next_renewal_date,
        auto_renew: ad.auto_renew,
      };

      try {
        const subscription = await stripe.subscriptions.retrieve(ad.stripe_subscription_id);
        if (subscription.status !== "canceled") {
          const fromStripe = billingFieldsFromStripeSubscription(subscription);
          if (fromStripe) {
            candidate = {
              plan_start_date: fromStripe.plan_start_date,
              plan_end_date: fromStripe.plan_end_date,
              next_renewal_date: fromStripe.next_renewal_date,
              auto_renew: fromStripe.auto_renew,
            };
          }
        }
      } catch (err) {
        console.error(`sync-ad-billing: Stripe retrieve failed for ad ${ad.id}:`, err.message);
      }

      // If renewal is still in the past, roll anniversary windows forward for live ads.
      const eff = effectiveBillingDates({
        ...ad,
        ...candidate,
      });
      const updates = {
        plan_start_date: eff.plan_start_date,
        plan_end_date: eff.plan_end_date,
        next_renewal_date: eff.next_renewal_date,
        auto_renew: candidate.auto_renew,
      };

      const changed =
        updates.plan_start_date !== ad.plan_start_date
        || updates.plan_end_date !== ad.plan_end_date
        || updates.next_renewal_date !== ad.next_renewal_date
        || updates.auto_renew !== ad.auto_renew;

      if (!changed) continue;

      const { error } = await admin.from("banner_ads").update(updates).eq("id", ad.id);
      if (error) throw error;
      synced.push({ id: ad.id, ...updates });
    }

    return res.status(200).json({ success: true, synced_count: synced.length, synced });
  } catch (error) {
    console.error("sync-ad-billing error:", error);
    return res.status(500).json({ error: error.message || "Failed to sync ad billing" });
  }
}
