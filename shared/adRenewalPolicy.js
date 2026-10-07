/** Days before renewal/end when auto-renew changes are locked (matches TOS §5). */
export const RENEWAL_CANCELLATION_WINDOW_DAYS = 14;

/** Parse YYYY-MM-DD (or Date) as a local calendar day — avoid UTC shift from `new Date("YYYY-MM-DD")`. */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    if (Number.isNaN(dateStr.getTime())) return null;
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  }
  const raw = String(dateStr).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    const fallback = new Date(dateStr);
    if (Number.isNaN(fallback.getTime())) return null;
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

export function formatLocalYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addPlanPeriod(date, planType) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (planType === "annual") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export function daysUntilDate(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (24 * 60 * 60 * 1000));
}

export function renewalDeadline(ad) {
  return ad?.next_renewal_date || ad?.plan_end_date || null;
}

/**
 * When stored next_renewal_date is already past but the ad is still live,
 * advance anniversary windows until renewal is today or in the future.
 * Covers missed Stripe webhook updates so cancel/renew UI never cites a past end date.
 */
export function effectiveBillingDates(ad) {
  if (!ad) {
    return {
      plan_start_date: null,
      plan_end_date: null,
      next_renewal_date: null,
      adjusted: false,
    };
  }

  let start = ad.plan_start_date || null;
  let end = ad.plan_end_date || ad.next_renewal_date || null;
  let next = ad.next_renewal_date || ad.plan_end_date || null;
  const live = ["active", "past_due", "flagged"].includes(ad.status);
  const days = daysUntilDate(next);

  if (!live || !next || days === null || days >= 0) {
    return {
      plan_start_date: start,
      plan_end_date: end,
      next_renewal_date: next,
      adjusted: false,
    };
  }

  const planType = ad.plan_type === "annual" ? "annual" : "monthly";
  let cursor = parseLocalDate(next);
  let guard = 0;
  while (cursor && daysUntilDate(formatLocalYmd(cursor)) < 0 && guard < 48) {
    const periodStart = cursor;
    cursor = addPlanPeriod(cursor, planType);
    start = formatLocalYmd(periodStart);
    end = formatLocalYmd(cursor);
    next = end;
    guard += 1;
  }

  return {
    plan_start_date: start,
    plan_end_date: end,
    next_renewal_date: next,
    adjusted: true,
  };
}

/** Merge effective (possibly rolled-forward) billing dates onto an ad for UI/policy checks. */
export function withEffectiveBillingDates(ad) {
  if (!ad) return ad;
  const eff = effectiveBillingDates(ad);
  return {
    ...ad,
    plan_start_date: eff.plan_start_date,
    plan_end_date: eff.plan_end_date,
    next_renewal_date: eff.next_renewal_date,
  };
}

/**
 * True when the next renewal charge is committed (fewer than 14 days remain,
 * and the renewal date is still today or in the future).
 */
export function isWithinCancellationLock(ad) {
  const days = daysUntilDate(renewalDeadline(withEffectiveBillingDates(ad)));
  if (days === null) return false;
  return days >= 0 && days < RENEWAL_CANCELLATION_WINDOW_DAYS;
}

/** True when supporter may turn auto-renew back on (outside the 14-day lock window). */
export function canResumeAutoRenew(ad) {
  const days = daysUntilDate(renewalDeadline(withEffectiveBillingDates(ad)));
  if (days === null) return false;
  return days >= RENEWAL_CANCELLATION_WINDOW_DAYS;
}
