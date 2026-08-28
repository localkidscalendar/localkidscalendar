/**
 * Shared Stripe Checkout session builder for new + resumed Supporter ad payments.
 */

export function applyDiscountToRate(rate, discountPercent) {
  const base = Number(rate);
  const pct = Number(discountPercent);
  if (!pct || pct <= 0) return base;
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

export function formatDiscountRenewalsLabel(renewalsApplicable, planType) {
  const cycles = Number(renewalsApplicable);
  if (!Number.isFinite(cycles) || cycles <= 0) {
    return "Ongoing discount on this subscription";
  }
  if (cycles === 1) {
    return "Applies to your first payment only";
  }
  const unit = planType === "annual" ? "year" : "month";
  return `Applies to your first ${cycles} ${unit}${cycles === 1 ? "" : "s"}`;
}

export async function validateCheckoutDiscount(
  admin,
  { discountCode, planType, userId, userEmail }
) {
  const code = (discountCode || "").trim().toUpperCase();
  if (!code) {
    return {
      valid: true,
      code: "",
      discountPercent: 0,
      discountCodeId: null,
      discountRenewalsApplicable: 1,
      empty: true,
    };
  }

  const { data: dc, error } = await admin
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) throw error;

  if (!dc) {
    return {
      valid: false,
      code,
      error: "This code wasn't found. Check spelling and try again.",
    };
  }

  if (dc.status !== "active") {
    return { valid: false, code, error: "This code is no longer active." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dc.expires_date && dc.expires_date < today) {
    return { valid: false, code, error: "This code has expired." };
  }

  if (dc.plan_type !== "both" && dc.plan_type !== planType) {
    const planLabel = dc.plan_type === "annual" ? "annual" : "monthly";
    return {
      valid: false,
      code,
      error: `This code only works on ${planLabel} plans.`,
    };
  }

  const usesByUser = (dc.used_by_user_ids || []).filter((id) => id === userId).length;
  const maxUses = Number(dc.max_uses_per_user || 1);
  if (usesByUser >= maxUses) {
    return {
      valid: false,
      code,
      error: "You've already used this code the maximum number of times.",
    };
  }

  const email = (userEmail || "").trim().toLowerCase();
  if (dc.restricted_email && dc.restricted_email.trim().toLowerCase() !== email) {
    return {
      valid: false,
      code,
      error: "This code isn't valid for your account email.",
    };
  }

  const discountPercent = Number(dc.discount_percent);
  return {
    valid: true,
    code,
    discountPercent,
    discountCodeId: dc.id,
    discountRenewalsApplicable: Number(dc.renewals_applicable ?? 1),
    empty: false,
  };
}

export async function resolveCheckoutDiscount(
  admin,
  { discountCode, planType, userId, userEmail }
) {
  const result = await validateCheckoutDiscount(admin, {
    discountCode,
    planType,
    userId,
    userEmail,
  });

  if (!result.valid) {
    return {
      discountPercent: 0,
      discountCodeId: null,
      discountRenewalsApplicable: 1,
      invalid: true,
      error: result.error,
    };
  }

  return {
    discountPercent: result.discountPercent,
    discountCodeId: result.discountCodeId,
    discountRenewalsApplicable: result.discountRenewalsApplicable,
    invalid: false,
  };
}

export async function createAdSubscriptionCheckoutSession(stripe, {
  adId,
  userId,
  zipCode,
  planType,
  rateAtPurchase,
  discountPercent,
  discountCodeId,
  discountRenewalsApplicable,
  adLibraryId,
  waitlistEntryId,
  userEmail,
  successUrl,
  cancelUrl,
}) {
  const sessionParams = {
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(rateAtPurchase * 100),
          recurring: { interval: planType === "annual" ? "year" : "month" },
          product_data: {
            name: `Local Kids Calendar Supporter Ad — Zip ${zipCode} (${planType === "annual" ? "Annual" : "Monthly"})`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ad_id: adId,
      user_id: userId,
      zip_code: zipCode,
      plan_type: planType,
      discount_code_id: discountCodeId || "",
      ad_library_id: adLibraryId || "",
      waitlist_entry_id: waitlistEntryId || "",
      rate_at_purchase: String(rateAtPurchase),
    },
    subscription_data: {
      metadata: {
        ad_id: adId,
        user_id: userId,
      },
    },
  };

  if (userEmail) sessionParams.customer_email = userEmail;

  if (discountPercent > 0) {
    const cycles = Number.isFinite(discountRenewalsApplicable) ? discountRenewalsApplicable : 1;
    let coupon;
    if (cycles <= 0) {
      coupon = await stripe.coupons.create({ percent_off: discountPercent, duration: "forever" });
    } else if (cycles === 1) {
      coupon = await stripe.coupons.create({ percent_off: discountPercent, duration: "once" });
    } else {
      const durationInMonths = planType === "annual" ? cycles * 12 : cycles;
      coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: "repeating",
        duration_in_months: durationInMonths,
      });
    }
    sessionParams.discounts = [{ coupon: coupon.id }];
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export function checkoutCancelUrl(origin, adId, override) {
  const base = override || `${origin}/ad-manager?cancelled=true`;
  if (base.includes("ad_id=")) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}ad_id=${adId}`;
}
