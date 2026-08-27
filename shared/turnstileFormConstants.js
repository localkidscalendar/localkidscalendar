/** Cloudflare Turnstile `action` values (must match widget + /api/verify-turnstile). */
export const TURNSTILE_ACTION_CONTACT = "contact";
export const TURNSTILE_ACTION_REGISTER = "register";
export const TURNSTILE_ACTION_REACTIVATE = "reactivate";

/** Actions accepted by /api/verify-turnstile (Contact Us uses /api/contact-submit). */
export const VERIFY_TURNSTILE_ACTIONS = [
  TURNSTILE_ACTION_REGISTER,
  TURNSTILE_ACTION_REACTIVATE,
];

/** Shared honeypot field name for /api/verify-turnstile (must stay empty). */
export const TURNSTILE_HONEYPOT_FIELD = "website";

/** Minimum ms the form must be open before a real submit (client + server). */
export const REGISTER_MIN_SUBMIT_MS = 3000;
export const REACTIVATE_MIN_SUBMIT_MS = 2000;

/** Reject timing tokens older than this (stale replay). */
export const TURNSTILE_MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

export const TURNSTILE_ACTION_MIN_MS = {
  [TURNSTILE_ACTION_REGISTER]: REGISTER_MIN_SUBMIT_MS,
  [TURNSTILE_ACTION_REACTIVATE]: REACTIVATE_MIN_SUBMIT_MS,
};
