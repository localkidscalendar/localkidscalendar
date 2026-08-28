import Stripe from "stripe";
import { getEnv, createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import {
  RENEWAL_CANCELLATION_WINDOW_DAYS,
  canResumeAutoRenew,
  daysUntilDate,
  renewalDeadline,
} from "../shared/adRenewalPolicy.js";

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
      .select("id, user_id, status, auto_renew, stripe_subscription_id, next_renewal_date, plan_end_date")
      .eq("id", adId)
      .maybeSingle();
    if (adError) throw adError;
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    if (ad.user_id !== authUser.id) return res.status(403).json({ error: "Forbidden" });

    if (!["active", "past_due"].includes(ad.status)) {
      return res.status(400).json({ error: "Only active ads can turn auto-renew back on." });
    }

    if (ad.auto_renew !== false) {
      return res.status(400).json({ error: "This ad is already set to auto-renew." });
    }

    if (!canResumeAutoRenew(ad)) {
      const daysLeft = daysUntilDate(renewalDeadline(ad));
      if (daysLeft !== null && daysLeft < 0) {
        return res.status(400).json({ error: "This ad term has already ended." });
      }
      return res.status(400).json({
        error: `Auto-renew cannot be turned back on within ${RENEWAL_CANCELLATION_WINDOW_DAYS} days of your renewal date.`,
      });
    }

    if (ad.stripe_subscription_id) {
      const stripe = new Stripe(stripeSecret);
      const subscription = await stripe.subscriptions.retrieve(ad.stripe_subscription_id);
      if (subscription.status === "canceled") {
        return res.status(400).json({ error: "This subscription has already ended." });
      }
      await stripe.subscriptions.update(ad.stripe_subscription_id, { cancel_at_period_end: false });
    }

    const { error: updateError } = await admin
      .from("banner_ads")
      .update({ auto_renew: true })
      .eq("id", adId);
    if (updateError) throw updateError;

    console.log(`resume-ad-renewal: ad ${adId} auto-renew restored by user ${authUser.id}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("resume-ad-renewal error:", error);
    return res.status(500).json({ error: error.message || "Failed to resume auto-renew" });
  }
}
