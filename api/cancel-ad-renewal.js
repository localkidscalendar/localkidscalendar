import Stripe from "stripe";
import { getEnv, createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import { billingFieldsFromStripeSubscription } from "./_lib/syncAdSubscription.js";
import { effectiveBillingDates } from "../shared/adRenewalPolicy.js";

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

    const { ad_id: adId } = req.body || {};
    if (!adId) return res.status(400).json({ error: "Missing ad_id" });

    const admin = createAdminClient();
    const { data: ad, error: adError } = await admin
      .from("banner_ads")
      .select(
        "id, user_id, status, plan_type, stripe_subscription_id, plan_start_date, plan_end_date, next_renewal_date"
      )
      .eq("id", adId)
      .maybeSingle();
    if (adError) throw adError;
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    if (ad.user_id !== authUser.id) return res.status(403).json({ error: "Forbidden" });

    let periodUpdates = {
      plan_start_date: ad.plan_start_date,
      plan_end_date: ad.plan_end_date,
      next_renewal_date: ad.next_renewal_date,
    };

    if (ad.stripe_subscription_id) {
      const stripe = new Stripe(stripeSecret);
      const subscription = await stripe.subscriptions.update(ad.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      const fromStripe = billingFieldsFromStripeSubscription(subscription);
      if (fromStripe) {
        periodUpdates = {
          plan_start_date: fromStripe.plan_start_date,
          plan_end_date: fromStripe.plan_end_date,
          next_renewal_date: fromStripe.next_renewal_date,
        };
      }
    }

    const eff = effectiveBillingDates({ ...ad, ...periodUpdates });
    periodUpdates = {
      plan_start_date: eff.plan_start_date,
      plan_end_date: eff.plan_end_date,
      next_renewal_date: eff.next_renewal_date,
    };

    const { error: updateError } = await admin
      .from("banner_ads")
      .update({ ...periodUpdates, auto_renew: false })
      .eq("id", adId);
    if (updateError) throw updateError;

    console.log(`cancel-ad-renewal: ad ${adId} set to cancel_at_period_end by user ${authUser.id}`);
    return res.status(200).json({ success: true, billing: periodUpdates });
  } catch (error) {
    console.error("cancel-ad-renewal error:", error);
    return res.status(500).json({ error: error.message || "Failed to cancel renewal" });
  }
}
