import Stripe from "stripe";
import {
  createAdminClient,
  getEnv,
  getPricing,
  computeAnnualPrice,
} from "./_lib/stripeHelpers.js";
import {
  notifyPlanUpgradeConfirmed,
  notifyPlanDowngradeConfirmed,
} from "./_lib/adBillingNotices.js";

const LOCK_IN_DAYS = 21;

async function ensureSubscriptionPrice(stripe, subscriptionId, { unitAmountCents, interval, productName }) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("No subscription item found");

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: unitAmountCents,
    recurring: { interval },
    product_data: { name: productName },
  });

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: price.id }],
    proration_behavior: "none",
    billing_cycle_anchor: "unchanged",
  });
}

/**
 * Daily cron: lock in pending plan switches within 21 days of renewal,
 * update Stripe when possible, and send in-app confirmation messages.
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
    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
    const pricing = await getPricing(admin);
    const now = Date.now();
    let checked = 0;
    let switched = 0;

    const { data: upgrades, error: upErr } = await admin
      .from("banner_ads")
      .select("*")
      .eq("status", "active")
      .eq("plan_type", "monthly")
      .eq("upgrade_to_annual_pending", true)
      .limit(200);
    if (upErr) throw upErr;

    for (const ad of upgrades || []) {
      checked += 1;
      if (!ad.next_renewal_date) continue;
      const daysUntil = (new Date(ad.next_renewal_date).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysUntil > LOCK_IN_DAYS) continue;

      const annualRate =
        ad.upgrade_locked_annual_rate != null
          ? Number(ad.upgrade_locked_annual_rate)
          : computeAnnualPrice(pricing.monthly_rate, pricing.annual_discount_percent);

      try {
        if (stripe && ad.stripe_subscription_id) {
          await ensureSubscriptionPrice(stripe, ad.stripe_subscription_id, {
            unitAmountCents: Math.round(annualRate * 100),
            interval: "year",
            productName: `Local Kids Calendar Supporter Ad — Zip ${ad.zip_code} (Annual)`,
          });
        }

        const { error: updateErr } = await admin
          .from("banner_ads")
          .update({
            plan_type: "annual",
            rate_at_purchase: annualRate,
            upgrade_locked_annual_rate: annualRate,
            upgrade_to_annual_pending: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ad.id);
        if (updateErr) throw updateErr;

        await notifyPlanUpgradeConfirmed(admin, ad, {
          renewalDate: ad.next_renewal_date,
        });
        switched += 1;
        console.log(`cron-process-ad-plan-changes: ad ${ad.id} → annual @ $${annualRate}`);
      } catch (err) {
        console.error(`cron-process-ad-plan-changes: upgrade failed for ${ad.id}:`, err.message);
      }
    }

    const { data: downgrades, error: downErr } = await admin
      .from("banner_ads")
      .select("*")
      .eq("status", "active")
      .eq("plan_type", "annual")
      .eq("downgrade_to_monthly_pending", true)
      .limit(200);
    if (downErr) throw downErr;

    for (const ad of downgrades || []) {
      checked += 1;
      if (!ad.next_renewal_date) continue;
      const daysUntil = (new Date(ad.next_renewal_date).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysUntil > LOCK_IN_DAYS) continue;

      const monthlyRate =
        ad.downgrade_locked_monthly_rate != null
          ? Number(ad.downgrade_locked_monthly_rate)
          : Number(pricing.monthly_rate);

      try {
        if (stripe && ad.stripe_subscription_id) {
          await ensureSubscriptionPrice(stripe, ad.stripe_subscription_id, {
            unitAmountCents: Math.round(monthlyRate * 100),
            interval: "month",
            productName: `Local Kids Calendar Supporter Ad — Zip ${ad.zip_code} (Monthly)`,
          });
        }

        const { error: updateErr } = await admin
          .from("banner_ads")
          .update({
            plan_type: "monthly",
            rate_at_purchase: monthlyRate,
            downgrade_locked_monthly_rate: monthlyRate,
            downgrade_to_monthly_pending: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ad.id);
        if (updateErr) throw updateErr;

        await notifyPlanDowngradeConfirmed(admin, ad, {
          renewalDate: ad.next_renewal_date,
        });
        switched += 1;
        console.log(`cron-process-ad-plan-changes: ad ${ad.id} → monthly @ $${monthlyRate}`);
      } catch (err) {
        console.error(`cron-process-ad-plan-changes: downgrade failed for ${ad.id}:`, err.message);
      }
    }

    return res.status(200).json({ ok: true, checked, switched });
  } catch (err) {
    console.error("cron-process-ad-plan-changes failed:", err);
    return res.status(500).json({ error: err.message || "Failed" });
  }
}
