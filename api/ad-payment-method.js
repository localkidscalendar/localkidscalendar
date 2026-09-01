import Stripe from "stripe";
import { getEnv, createAdminClient, requireUser } from "./_lib/stripeHelpers.js";

function cardSummary(paymentMethod) {
  const card = paymentMethod?.card;
  if (!card?.last4) return null;
  return {
    brand: card.brand || "card",
    last4: card.last4,
    exp_month: card.exp_month || null,
    exp_year: card.exp_year || null,
  };
}

async function cardFromPaymentMethod(stripe, paymentMethod) {
  if (!paymentMethod) return null;
  if (typeof paymentMethod === "string") {
    try {
      const retrieved = await stripe.paymentMethods.retrieve(paymentMethod);
      return cardSummary(retrieved);
    } catch {
      return null;
    }
  }
  return cardSummary(paymentMethod);
}

async function resolveDefaultCard(stripe, customerId, subscriptionId) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  const fromCustomer = await cardFromPaymentMethod(
    stripe,
    customer.invoice_settings?.default_payment_method
  );
  if (fromCustomer) return fromCustomer;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method", "latest_invoice.payment_intent.payment_method"],
    });
    const fromSub = await cardFromPaymentMethod(stripe, subscription.default_payment_method);
    if (fromSub) return fromSub;

    const invoice = subscription.latest_invoice;
    const paymentIntent =
      typeof invoice === "object" ? invoice?.payment_intent : null;
    const fromInvoice = await cardFromPaymentMethod(
      stripe,
      typeof paymentIntent === "object" ? paymentIntent?.payment_method : null
    );
    if (fromInvoice) return fromInvoice;
  }

  const listed = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 3,
  });
  for (const method of listed.data || []) {
    const summary = cardSummary(method);
    if (summary) return summary;
  }

  return null;
}

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
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("id", adId)
      .maybeSingle();
    if (adError) throw adError;
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    if (ad.user_id !== authUser.id) return res.status(403).json({ error: "Forbidden" });
    if (!ad.stripe_customer_id) {
      return res.status(200).json({ card: null });
    }

    const stripe = new Stripe(stripeSecret);
    const card = await resolveDefaultCard(
      stripe,
      ad.stripe_customer_id,
      ad.stripe_subscription_id || null
    );
    return res.status(200).json({ card });
  } catch (error) {
    console.error("ad-payment-method error:", error);
    return res.status(500).json({ error: error.message || "Failed to load payment method" });
  }
}
