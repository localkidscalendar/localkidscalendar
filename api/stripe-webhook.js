import Stripe from "stripe";
import { getEnv, createAdminClient, planDates } from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";
import {
  GRACE_PERIOD_DAYS,
  notifyPaymentFailed,
  notifySubscriptionRenewed,
} from "./_lib/adBillingNotices.js";
import { isAdDiscountActive } from "../shared/adRateDisplay.js";

// Stripe requires the raw request body to verify the webhook signature.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function subscriptionIdOf(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

async function handleCheckoutCompleted(admin, session) {
  const meta = session.metadata || {};
  const adId = meta.ad_id;
  if (!adId) {
    console.log("stripe-webhook: checkout.session.completed with no ad_id, skipping");
    return;
  }

  const { start: planStart, end: planEnd } = planDates(meta.plan_type);

  const adUpdate = {
    status: "active",
    moderation_status: "auto_approved",
    stripe_subscription_id: subscriptionIdOf(session.subscription),
    stripe_customer_id: subscriptionIdOf(session.customer),
    plan_start_date: planStart,
    plan_end_date: planEnd,
    next_renewal_date: planEnd,
    rate_at_purchase: meta.rate_at_purchase ? Number(meta.rate_at_purchase) : null,
    discount_cycles_used: 0,
    grace_period_start: null,
    cancelled_at: null,
  };

  if (meta.discount_renewals_applicable !== undefined && meta.discount_renewals_applicable !== "") {
    adUpdate.discount_renewals_applicable = Number(meta.discount_renewals_applicable);
  }

  if (meta.ad_library_id) {
    const { data: libAd } = await admin
      .from("ad_library")
      .select("image_url, link_url, moderation_status")
      .eq("id", meta.ad_library_id)
      .maybeSingle();
    if (libAd && libAd.moderation_status === "approved") {
      adUpdate.image_url = libAd.image_url;
      adUpdate.link_url = libAd.link_url;
    } else {
      adUpdate.status = "pending_review";
      adUpdate.moderation_status = "needs_review";
    }
  }

  await admin.from("banner_ads").update(adUpdate).eq("id", adId);

  if (meta.waitlist_entry_id) {
    await admin.from("ad_waitlist").update({ status: "accepted" }).eq("id", meta.waitlist_entry_id);
  } else if (meta.user_id && meta.zip_code) {
    await admin
      .from("ad_waitlist")
      .update({ status: "accepted" })
      .eq("user_id", meta.user_id)
      .eq("zip_code", meta.zip_code)
      .eq("status", "offered");
  }

  if (meta.discount_code_id) {
    const { data: dc } = await admin
      .from("discount_codes")
      .select("times_used, used_by_user_ids, used_by_records")
      .eq("id", meta.discount_code_id)
      .maybeSingle();
    if (dc) {
      let userName = "Unknown user";
      if (meta.user_id) {
        const { data: profile } = await admin
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", meta.user_id)
          .maybeSingle();
        if (profile) {
          userName =
            [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
            profile.email ||
            "Unknown user";
        }
      }

      let adName = null;
      let zipCode = meta.zip_code || null;
      const { data: adRow } = await admin
        .from("banner_ads")
        .select("business_name, zip_code")
        .eq("id", adId)
        .maybeSingle();
      if (adRow) {
        adName = adRow.business_name || null;
        zipCode = adRow.zip_code || zipCode;
      }

      const usageRecord = {
        user_id: meta.user_id || null,
        user_name: userName,
        ad_name: adName,
        zip_code: zipCode,
        used_date: new Date().toISOString(),
      };

      await admin
        .from("discount_codes")
        .update({
          times_used: Number(dc.times_used || 0) + 1,
          used_by_user_ids: [...(dc.used_by_user_ids || []), meta.user_id].filter(Boolean),
          used_by_records: [
            ...(Array.isArray(dc.used_by_records) ? dc.used_by_records : []),
            usageRecord,
          ],
        })
        .eq("id", meta.discount_code_id);
    }
  }

  if (meta.user_id) {
    await admin.from("profiles").update({ is_advertiser: true }).eq("id", meta.user_id);
  }

  console.log(`stripe-webhook: ad ${adId} activated after successful payment`);
}

async function handleSubscriptionDeleted(admin, subscription) {
  const adId = subscription.metadata?.ad_id;
  if (!adId) return;

  await admin
    .from("banner_ads")
    .update({
      status: "cancelled",
      auto_renew: false,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", adId);

  console.log(`stripe-webhook: ad ${adId} cancelled after subscription deletion`);

  // Freeing a slot — advance the waitlist for that zip (and any others with capacity).
  try {
    const result = await runProcessWaitlist(admin);
    console.log("stripe-webhook: processWaitlist after cancel:", result);
  } catch (err) {
    console.error("stripe-webhook: processWaitlist failed after cancel:", err.message);
  }
}

async function handlePaymentFailed(admin, invoice) {
  const subId = subscriptionIdOf(invoice.subscription);
  if (!subId) return;

  const { data: ads } = await admin
    .from("banner_ads")
    .select("*")
    .eq("stripe_subscription_id", subId);
  for (const ad of ads || []) {
    if (ad.status === "active") {
      const gracePeriodStart = new Date().toISOString();
      await admin
        .from("banner_ads")
        .update({ status: "past_due", grace_period_start: gracePeriodStart })
        .eq("id", ad.id);
      console.log(`stripe-webhook: ad ${ad.id} moved to past_due (grace period ${GRACE_PERIOD_DAYS}d)`);
      try {
        await notifyPaymentFailed(admin, { ...ad, status: "past_due", grace_period_start: gracePeriodStart });
      } catch (err) {
        console.error(`stripe-webhook: failed to notify payment failed for ad ${ad.id}:`, err.message);
      }
    }
  }
}

async function syncAdDiscountFromSubscription(stripe, ad) {
  if (!ad?.stripe_subscription_id) return {};
  try {
    const subscription = await stripe.subscriptions.retrieve(ad.stripe_subscription_id);
    const percentOff = subscription.discount?.coupon?.percent_off;
    if (Number.isFinite(Number(percentOff)) && Number(percentOff) > 0) {
      return { discount_amount: Number(percentOff) };
    }
    if (ad.discount_amount) {
      return { discount_amount: null };
    }
  } catch (err) {
    console.error(`stripe-webhook: failed to sync discount for ad ${ad.id}:`, err.message);
  }
  return {};
}

async function handlePaymentSucceeded(admin, stripe, invoice) {
  const subId = subscriptionIdOf(invoice.subscription);
  if (!subId || invoice.billing_reason === "subscription_create") return;

  const { data: ads } = await admin.from("banner_ads").select("*").eq("stripe_subscription_id", subId);
  for (const ad of ads || []) {
    const updates = {};
    const wasPastDue = ad.status === "past_due";
    const isRenewal = invoice.billing_reason === "subscription_cycle";

    if (isRenewal) {
      const { start, end } = planDates(ad.plan_type);
      updates.plan_start_date = start;
      updates.plan_end_date = end;
      updates.next_renewal_date = end;
      updates.discount_cycles_used = (Number(ad.discount_cycles_used) || 0) + 1;
    }

    Object.assign(updates, await syncAdDiscountFromSubscription(stripe, { ...ad, ...updates }));

    if (
      isRenewal &&
      ad.discount_renewals_applicable != null &&
      Number(ad.discount_renewals_applicable) > 0 &&
      Number(updates.discount_cycles_used ?? ad.discount_cycles_used) >=
        Number(ad.discount_renewals_applicable)
    ) {
      updates.discount_amount = null;
    } else if (!isAdDiscountActive({ ...ad, ...updates })) {
      updates.discount_amount = null;
    }

    if (wasPastDue) {
      updates.status = "active";
      updates.grace_period_start = null;
    }

    if (Object.keys(updates).length > 0) {
      await admin.from("banner_ads").update(updates).eq("id", ad.id);
      console.log(`stripe-webhook: ad ${ad.id} updated after payment success`, updates);
    }

    if (isRenewal || wasPastDue) {
      try {
        await notifySubscriptionRenewed(admin, { ...ad, ...updates });
      } catch (err) {
        console.error(`stripe-webhook: failed to notify renewal for ad ${ad.id}:`, err.message);
      }
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecret = getEnv("STRIPE_SECRET_KEY");
  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecret || !webhookSecret) {
    console.error("stripe-webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Server missing Stripe configuration" });
  }

  const stripe = new Stripe(stripeSecret);

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("stripe-webhook: missing Supabase service role configuration:", err.message);
    return res.status(500).json({ error: "Server missing Supabase configuration" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(admin, event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(admin, stripe, event.data.object);
        break;
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`stripe-webhook: error handling ${event.type}:`, error);
    return res.status(500).json({ error: error.message || "Webhook handler failed" });
  }
}
