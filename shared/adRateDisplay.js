/**
 * Supporter ad rate display helpers (list rate vs discounted amount actually paid).
 * `rate_at_purchase` on banner_ads is the list rate locked for the term, not the site-wide current rate.
 */

export function applyDiscountToRate(rate, discountPercent) {
  const base = Number(rate);
  const pct = Number(discountPercent);
  if (!Number.isFinite(base) || base < 0) return null;
  if (!pct || pct <= 0) return base;
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

export function formatCurrencyAmount(amount) {
  if (amount === null || amount === undefined || amount === "") return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2);
}

export function planRateSuffix(planType) {
  return planType === "annual" ? "/yr" : "/mo";
}

export function formatRateAmount(amount, planType) {
  const formatted = formatCurrencyAmount(amount);
  if (formatted === null) return null;
  return `$${formatted}${planRateSuffix(planType)}`;
}

export function isAdDiscountActive(ad) {
  const pct = Number(ad?.discount_amount);
  if (!Number.isFinite(pct) || pct <= 0) return false;

  const renewals = ad?.discount_renewals_applicable;
  if (renewals === null || renewals === undefined || renewals === "") {
    // Legacy rows: show discount when percent is still stored.
    return true;
  }

  const renewalLimit = Number(renewals);
  if (!Number.isFinite(renewalLimit) || renewalLimit <= 0) {
    return true;
  }

  const cyclesUsed = Number(ad?.discount_cycles_used) || 0;
  return cyclesUsed < renewalLimit;
}

export function getAdTermRates(ad) {
  const rawList = ad?.rate_at_purchase;
  if (rawList === null || rawList === undefined || rawList === "") {
    return {
      listRate: null,
      effectiveRate: null,
      discountPercent: 0,
      discountActive: false,
      discountCode: null,
    };
  }

  const listRate = Number(rawList);
  if (!Number.isFinite(listRate) || listRate < 0) {
    return {
      listRate: null,
      effectiveRate: null,
      discountPercent: 0,
      discountActive: false,
      discountCode: null,
    };
  }

  const discountActive = isAdDiscountActive(ad);
  const discountPercent = discountActive ? Number(ad.discount_amount) || 0 : 0;
  const effectiveRate =
    discountPercent > 0 ? applyDiscountToRate(listRate, discountPercent) : listRate;

  return {
    listRate,
    effectiveRate,
    discountPercent,
    discountActive: discountPercent > 0,
    discountCode: discountPercent > 0 ? ad?.discount_code_used || null : null,
  };
}

export function formatAdPayingRate(ad) {
  const { effectiveRate } = getAdTermRates(ad);
  return formatRateAmount(effectiveRate, ad?.plan_type);
}

export function formatAdListRate(ad) {
  const { listRate } = getAdTermRates(ad);
  return formatRateAmount(listRate, ad?.plan_type);
}
