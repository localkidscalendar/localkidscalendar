import {
  VERIFY_TURNSTILE_ACTIONS,
  TURNSTILE_ACTION_MIN_MS,
  TURNSTILE_HONEYPOT_FIELD,
  TURNSTILE_MAX_FORM_AGE_MS,
} from "../../shared/turnstileFormConstants.js";

/**
 * Parse body for /api/verify-turnstile (honeypot + timing + action + token).
 * @returns {{ ok: true, payload: object } | { ok: false, bot: boolean, error?: string }}
 */
export function parseTurnstileVerifyBody(raw = {}) {
  const honeypot = String(
    raw[TURNSTILE_HONEYPOT_FIELD] ?? raw.website ?? raw.hp_website ?? ""
  ).trim();
  if (honeypot) {
    return { ok: false, bot: true };
  }

  const action = String(raw.action ?? "").trim();
  if (!VERIFY_TURNSTILE_ACTIONS.includes(action)) {
    return { ok: false, bot: false, error: "Invalid security check." };
  }

  const minMs = TURNSTILE_ACTION_MIN_MS[action];
  if (minMs == null) {
    return { ok: false, bot: false, error: "Invalid security check." };
  }

  const formLoadedAt = Number(raw.form_loaded_at ?? raw.formLoadedAt);
  if (!Number.isFinite(formLoadedAt) || formLoadedAt <= 0) {
    return { ok: false, bot: true };
  }

  const age = Date.now() - formLoadedAt;
  if (age < minMs || age > TURNSTILE_MAX_FORM_AGE_MS) {
    return { ok: false, bot: true };
  }

  const turnstile_token = String(raw.turnstile_token ?? raw.turnstileToken ?? "").trim();

  return {
    ok: true,
    payload: {
      action,
      turnstile_token,
      form_loaded_at: formLoadedAt,
    },
  };
}
