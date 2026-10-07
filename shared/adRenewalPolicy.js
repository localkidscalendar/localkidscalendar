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
 * True when the next renewal charge is committed (fewer than 14 days remain,
 * and the renewal date is still today or in the future).
 * Past renewal dates are not treated as locked — those usually mean stale DB
 * dates that should be synced from Stripe before showing cancel outcomes.
 */
export function isWithinCancellationLock(ad) {
  const days = daysUntilDate(renewalDeadline(ad));
  if (days === null) return false;
  return days >= 0 && days < RENEWAL_CANCELLATION_WINDOW_DAYS;
}

/** True when supporter may turn auto-renew back on (outside the 14-day lock window). */
export function canResumeAutoRenew(ad) {
  const days = daysUntilDate(renewalDeadline(ad));
  if (days === null) return false;
  return days >= RENEWAL_CANCELLATION_WINDOW_DAYS;
}
