import {
  createAdminClient,
  requireUser,
  computeAnnualPrice,
  getPricing,
} from "./_lib/stripeHelpers.js";
import {
  applyDiscountToRate,
  formatDiscountRenewalsLabel,
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
    const { user: authUser, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const { discount_code: discountCode, plan_type: planType } = req.body || {};
    if (!planType || !["monthly", "annual"].includes(planType)) {
      return res.status(400).json({ error: "plan_type must be monthly or annual" });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", authUser.id)
      .maybeSingle();
    const userEmail = (profile?.email || authUser.email || "").trim();

    const pricing = await getPricing(admin);
    const monthlyRate = Number(pricing.monthly_rate);
    const annualRate = computeAnnualPrice(monthlyRate, pricing.annual_discount_percent);
    const originalAmount = planType === "annual" ? annualRate : monthlyRate;

    const validation = await validateCheckoutDiscount(admin, {
      discountCode,
      planType,
      userId: authUser.id,
      userEmail,
    });

    if (!validation.valid) {
      return res.status(200).json({
        valid: false,
        error: validation.error,
        plan_type: planType,
        original_amount: originalAmount,
      });
    }

    if (validation.empty) {
      return res.status(200).json({
        valid: true,
        code: "",
        plan_type: planType,
        discount_percent: 0,
        original_amount: originalAmount,
        discounted_amount: originalAmount,
      });
    }

    const discountPercent = validation.discountPercent;
    const discountedAmount = applyDiscountToRate(originalAmount, discountPercent);

    return res.status(200).json({
      valid: true,
      code: validation.code,
      plan_type: planType,
      discount_percent: discountPercent,
      original_amount: originalAmount,
      discounted_amount: discountedAmount,
      renewals_applicable: validation.discountRenewalsApplicable,
      renewals_label: formatDiscountRenewalsLabel(
        validation.discountRenewalsApplicable,
        planType
      ),
    });
  } catch (error) {
    console.error("validate-ad-discount error:", error);
    return res.status(500).json({ error: error.message || "Failed to validate discount code" });
  }
}
