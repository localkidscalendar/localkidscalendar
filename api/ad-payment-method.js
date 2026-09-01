import Stripe from "stripe";
import { getEnv, createAdminClient, requireUser } from "./_lib/stripeHelpers.js";

function cardSummary(paymentMethod) {
  const card = paymentMethod?.card;
  if (!card?.last4) return null;
  return {
    type: "card",
    brand: card.brand || "card",
    last4: card.last4,
    exp_month: card.exp_month || null,
    exp_year: card.exp_year || null,
    via_link: card.wallet?.type === "link",
  };
}

function paymentMethodSummary(paymentMethod) {
  if (!paymentMethod) return null;

  const card = cardSummary(paymentMethod);
  if (card) return card;

  if (paymentMethod.type === "link") {
    return { type: "link", label: "Stripe Link" };
  }

  const bank = paymentMethod.us_bank_account;
  if (paymentMethod.type === "us_bank_account" && bank?.last4) {
    const bankName = bank.bank_name || "Bank account";
    return {
      type: "us_bank_account",
      brand: bankName,
      last4: bank.last4,
      label: `${bankName} •••• ${bank.last4}`,
    };
  }

  if (paymentMethod.type) {
    return { type: paymentMethod.type, label: "Payment method on file" };
  }

  return null;
}

function legacyCardSummary(source) {
  if (!source?.last4) return null;
  return {
    type: "card",
    brand: source.brand || "card",
    last4: source.last4,
    exp_month: source.exp_month || null,
    exp_year: source.exp_year || null,
    via_link: false,
  };
}

async function paymentMethodFromId(stripe, paymentMethod) {
  if (!paymentMethod) return null;
  if (typeof paymentMethod === "string") {
    try {
      const retrieved = await stripe.paymentMethods.retrieve(paymentMethod);
      return paymentMethodSummary(retrieved);
    } catch {
      return null;
    }
  }
  return paymentMethodSummary(paymentMethod);
}

async function legacySourceSummary(stripe, customerId, defaultSource) {
  if (!defaultSource) return null;
  if (typeof defaultSource === "object") {
    return legacyCardSummary(defaultSource);
  }
  try {
    const source = await stripe.customers.retrieveSource(customerId, defaultSource);
    return legacyCardSummary(source);
  } catch {
    return null;
  }
}

async function resolveDefaultPaymentMethod(stripe, customerId, subscriptionId) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method", "default_source"],
  });

  const fromCustomer = await paymentMethodFromId(
    stripe,
    customer.invoice_settings?.default_payment_method
  );
  if (fromCustomer) return fromCustomer;

  const fromLegacy = await legacySourceSummary(stripe, customerId, customer.default_source);
  if (fromLegacy) return fromLegacy;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method", "latest_invoice.payment_intent.payment_method"],
    });
    const fromSub = await paymentMethodFromId(stripe, subscription.default_payment_method);
    if (fromSub) return fromSub;

    const invoice = subscription.latest_invoice;
    const paymentIntent =
      typeof invoice === "object" ? invoice?.payment_intent : null;
    const fromInvoice = await paymentMethodFromId(
      stripe,
      typeof paymentIntent === "object" ? paymentIntent?.payment_method : null
    );
    if (fromInvoice) return fromInvoice;
  }

  const listed = await stripe.paymentMethods.list({
    customer: customerId,
    limit: 10,
  });
  for (const method of listed.data || []) {
    const summary = paymentMethodSummary(method);
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
      return res.status(200).json({ payment_method: null, card: null });
    }

    const stripe = new Stripe(stripeSecret);
    const paymentMethod = await resolveDefaultPaymentMethod(
      stripe,
      ad.stripe_customer_id,
      ad.stripe_subscription_id || null
    );
    const card =
      paymentMethod?.type === "card"
        ? {
            brand: paymentMethod.brand,
            last4: paymentMethod.last4,
            exp_month: paymentMethod.exp_month,
            exp_year: paymentMethod.exp_year,
          }
        : null;
    return res.status(200).json({ payment_method: paymentMethod, card });
  } catch (error) {
    console.error("ad-payment-method error:", error);
    return res.status(500).json({ error: error.message || "Failed to load payment method" });
  }
}
