import {
  SESSION_CHECKOUT_GRACE_KEY,
  SESSION_CHECKOUT_GRACE_MS,
  SESSION_IDLE_LOGOUT_FLAG,
  SESSION_LAST_ACTIVITY_KEY,
  isActivityExpired,
} from "../../shared/sessionActivityPolicy.js";

export function readLastActivityAt() {
  try {
    const raw = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastActivityAt(timestamp = Date.now()) {
  try {
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
  } catch {
    // ignore
  }
}

export function clearSessionActivityStorage() {
  try {
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(SESSION_CHECKOUT_GRACE_KEY);
    sessionStorage.removeItem(SESSION_IDLE_LOGOUT_FLAG);
  } catch {
    // ignore
  }
}

export function isLastActivityExpired(now = Date.now()) {
  const last = readLastActivityAt();
  if (!last) return false;
  return isActivityExpired(last, now);
}

export function markStripeCheckoutGrace() {
  try {
    sessionStorage.setItem(
      SESSION_CHECKOUT_GRACE_KEY,
      String(Date.now() + SESSION_CHECKOUT_GRACE_MS)
    );
  } catch {
    // ignore
  }
}

export function isWithinStripeCheckoutGrace(now = Date.now()) {
  try {
    const until = Number(sessionStorage.getItem(SESSION_CHECKOUT_GRACE_KEY));
    return Number.isFinite(until) && now < until;
  } catch {
    return false;
  }
}

export function markIdleLogoutFlag() {
  try {
    sessionStorage.setItem(SESSION_IDLE_LOGOUT_FLAG, "1");
  } catch {
    // ignore
  }
}

export function consumeIdleLogoutFlag() {
  try {
    const value = sessionStorage.getItem(SESSION_IDLE_LOGOUT_FLAG);
    sessionStorage.removeItem(SESSION_IDLE_LOGOUT_FLAG);
    return value === "1";
  } catch {
    return false;
  }
}
