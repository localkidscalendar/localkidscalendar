/** Client-side session activity policy (no Supabase/Vercel cost). */

/** Idle while the tab is open — then warn and sign out. */
export const SESSION_IDLE_MS = 45 * 60 * 1000;

/** Warning modal appears this long before idle sign-out. */
export const SESSION_IDLE_WARNING_MS = 5 * 60 * 1000;

/** Max time since last activity across browser restarts (overnight protection). */
export const SESSION_MAX_INACTIVITY_MS = 8 * 60 * 60 * 1000;

/** Grace after redirecting to Stripe Checkout (back button / slow payer). */
export const SESSION_CHECKOUT_GRACE_MS = 90 * 60 * 1000;

export const SESSION_LAST_ACTIVITY_KEY = "lkc_last_activity_at";
export const SESSION_CHECKOUT_GRACE_KEY = "lkc_stripe_checkout_grace_until";
export const SESSION_IDLE_LOGOUT_FLAG = "lkc_idle_logout";
export const SESSION_ACTIVITY_CHANNEL = "lkc_session_activity";

export function isActivityExpired(lastActivityMs, now = Date.now()) {
  if (!Number.isFinite(lastActivityMs) || lastActivityMs <= 0) return false;
  return now - lastActivityMs > SESSION_MAX_INACTIVITY_MS;
}
