/**
 * Shared Stripe Checkout session builder for new + resumed Supporter ad payments.
 */

export async function resolveCheckoutDiscount(
  admin,
  { discountCode, planType, userId, userEmail }
) {
  let discountPercent = 0;
  let discountCodeId = null;
  let discountRenewalsApplicable = 1;

  const code = (discountCode || "").trim().toUpperCase();
  if (!code) {
    return { discountPercent, discountCodeId, discountRenewalsApplicable };
  }

  const { data: dc } = await admin
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();

  if (!dc) {
    return { discountPercent, discountCodeId, discountRenewalsApplicable };
  }

  const today = new Date().toISOString().slice(0, 10);
  const notExpired = !dc.expires_date || dc.expires_date >= today;
  const planMatches = dc.plan_type === "both" || dc.plan_type === planType;
  const usesByUser = (dc.used_by_user_ids || []).filter((id) => id === userId).length;
  const notMaxedForUser = usesByUser < Number(dc.max_uses_per_user || 1);
  const emailMatches =
    !dc.restricted_email || dc.restricted_email.toLowerCase() === userEmail.toLowerCase();

  if (notExpired && planMatches && notMaxedForUser && emailMatches) {
    discountPercent = Number(dc.discount_percent);
    discountCodeId = dc.id;
    discountRenewalsApplicable = Number(dc.renewals_applicable ?? 1);
  }

  return { discountPercent, discountCodeId, discountRenewalsApplicable };
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
