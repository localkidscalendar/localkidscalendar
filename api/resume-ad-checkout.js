import Stripe from "stripe";
import {
  getEnv,
  createAdminClient,
  requireUser,
  computeAnnualPrice,
  getPricing,
} from "./_lib/stripeHelpers.js";
import {
  checkoutCancelUrl,
  createAdSubscriptionCheckoutSession,
  validateCheckoutDiscount,
} from "./_lib/stripeCheckoutSession.js";

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

    const { ad_id: adId, success_url: successUrlOverride, cancel_url: cancelUrlOverride, discount_code: discountCodeOverride } =
      req.body || {};

    if (!adId) {
      return res.status(400).json({ error: "ad_id is required" });
    }

    const admin = createAdminClient();
    const { data: ad, error: adError } = await admin
      .from("banner_ads")
      .select("*")
      .eq("id", adId)
      .maybeSingle();

    if (adError || !ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    if (ad.user_id !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (ad.status !== "pending_payment") {
      return res.status(400).json({ error: "This ad is not waiting for payment." });
    }

    if (ad.stripe_subscription_id) {
      return res.status(400).json({ error: "Payment already completed for this ad." });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", authUser.id)
      .maybeSingle();
    const userEmail = (profile?.email || authUser.email || "").trim();

    const planType = ad.plan_type;
    if (!planType || !["monthly", "annual"].includes(planType)) {
      return res.status(400).json({ error: "This ad has an invalid plan type." });
    }

    const pricing = await getPricing(admin);
    const monthlyRate = Number(pricing.monthly_rate);
    const annualRate = computeAnnualPrice(monthlyRate, pricing.annual_discount_percent);
    const rateAtPurchase = planType === "annual" ? annualRate : monthlyRate;

    const discountCode =
      discountCodeOverride !== undefined
        ? (discountCodeOverride || "").trim().toUpperCase() || null
        : ad.discount_code_used;

    const validation = await validateCheckoutDiscount(admin, {
      discountCode,
      planType,
      userId: authUser.id,
      userEmail,
    });

    if (discountCode && !validation.valid) {
      return res.status(400).json({ error: validation.error || "Invalid discount code" });
    }

    const discountPercent = validation.discountPercent || 0;
    const discountCodeId = validation.discountCodeId;
    const discountRenewalsApplicable = validation.discountRenewalsApplicable;

    if (
      discountCode !== ad.discount_code_used ||
      Number(ad.discount_amount || 0) !== discountPercent
    ) {
      const { error: updateError } = await admin
        .from("banner_ads")
        .update({
          discount_code_used: discountCode,
          discount_amount: discountPercent || null,
        })
        .eq("id", ad.id)
        .eq("user_id", authUser.id);
      if (updateError) throw updateError;
    }

    const stripe = new Stripe(stripeSecret);
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const successUrl =
      successUrlOverride || `${origin}/ad-manager?success=true&ad_id=${ad.id}`;
    const cancelUrl = checkoutCancelUrl(origin, ad.id, cancelUrlOverride);

    const session = await createAdSubscriptionCheckoutSession(stripe, {
      adId: ad.id,
      userId: authUser.id,
      zipCode: ad.zip_code,
      planType,
      rateAtPurchase,
      discountPercent,
      discountCodeId,
      discountRenewalsApplicable,
      adLibraryId: ad.ad_library_id,
      waitlistEntryId: "",
      userEmail,
      successUrl,
      cancelUrl,
    });

    return res.status(200).json({ url: session.url, ad_id: ad.id });
  } catch (error) {
    console.error("resume-ad-checkout error:", error);
    return res.status(500).json({ error: error.message || "Failed to resume checkout" });
  }
}
