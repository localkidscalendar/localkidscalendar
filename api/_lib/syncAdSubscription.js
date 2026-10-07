/**
 * Keep banner_ads plan dates aligned with Stripe subscription periods.
 * Stripe current_period_* is the billing source of truth after checkout/renewal.
 */

export function ymdFromUnixSeconds(seconds) {
  if (!Number.isFinite(Number(seconds))) return null;
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
}

/** Map Stripe subscription period + cancel flag onto banner_ads columns. */
export function billingFieldsFromStripeSubscription(subscription) {
  if (!subscription) return null;
  const plan_start_date = ymdFromUnixSeconds(subscription.current_period_start);
  const plan_end_date = ymdFromUnixSeconds(subscription.current_period_end);
  if (!plan_start_date || !plan_end_date) return null;
  return {
    plan_start_date,
    plan_end_date,
    next_renewal_date: plan_end_date,
    auto_renew: subscription.cancel_at_period_end !== true,
  };
}

/**
 * Persist Stripe period dates (and optionally auto_renew) onto a banner ad.
 * @returns {object|null} fields written, or null if subscription has no period
 */
export async function applyStripeSubscriptionToAd(
  admin,
  adId,
  subscription,
  { includeAutoRenew = true } = {}
) {
  const fields = billingFieldsFromStripeSubscription(subscription);
  if (!fields) return null;
  const updates = {
    plan_start_date: fields.plan_start_date,
    plan_end_date: fields.plan_end_date,
    next_renewal_date: fields.next_renewal_date,
  };
  if (includeAutoRenew) {
    updates.auto_renew = fields.auto_renew;
  }
  const { error } = await admin.from("banner_ads").update(updates).eq("id", adId);
  if (error) throw error;
  return updates;
}
