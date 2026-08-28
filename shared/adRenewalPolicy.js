/** Days before renewal/end when auto-renew changes are locked (matches TOS §5). */
export const RENEWAL_CANCELLATION_WINDOW_DAYS = 14;

export function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (24 * 60 * 60 * 1000));
}

export function renewalDeadline(ad) {
  return ad?.next_renewal_date || ad?.plan_end_date || null;
}

/** True when supporter may turn auto-renew back on (outside the 14-day lock window). */
export function canResumeAutoRenew(ad) {
  const days = daysUntilDate(renewalDeadline(ad));
  if (days === null) return false;
  return days >= RENEWAL_CANCELLATION_WINDOW_DAYS;
}
