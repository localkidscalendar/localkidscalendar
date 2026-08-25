import { getEnv } from "./stripeHelpers.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/**
 * @param {{ token: string, remoteip?: string, action?: string }} opts
 * @returns {Promise<{ success: boolean, skipped?: boolean, errorCodes?: string[] }>}
 */
export async function verifyTurnstileToken({ token, remoteip, action = "contact" }) {
  const secret = getEnv("TURNSTILE_SECRET_KEY");
  if (!secret) {
    if (isProductionRuntime()) {
      console.error("TURNSTILE_SECRET_KEY missing in production");
      return { success: false, errorCodes: ["missing-secret"] };
    }
    return { success: true, skipped: true };
  }

  if (!token) {
    return { success: false, errorCodes: ["missing-token"] };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteip) body.set("remoteip", remoteip);
  if (action) body.set("action", action);

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("Turnstile siteverify HTTP", res.status);
    return { success: false, errorCodes: ["siteverify-http"] };
  }

  const data = await res.json();
  if (!data.success) {
    return { success: false, errorCodes: data["error-codes"] || [] };
  }

  if (action && data.action && data.action !== action) {
    return { success: false, errorCodes: ["action-mismatch"] };
  }

  return { success: true };
}
