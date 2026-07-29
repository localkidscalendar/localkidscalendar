import { getEnv } from "./stripeHelpers.js";
import { isEmailSendingEnabled } from "./emailGuards.js";

/**
 * Send an email via Resend from a serverless function (no user JWT required).
 * Respects EMAIL_SENDING_ENABLED env kill switch.
 *
 * @param {{ to: string, subject: string, html: string, headers?: Record<string,string>|Array<{name:string,value:string}>, replyTo?: string }} opts
 */
export async function sendViaResend({ to, subject, html, headers, replyTo }) {
  if (!isEmailSendingEnabled()) {
    console.warn("EMAIL_SENDING_ENABLED is off — skipped send", { to, subject });
    return { id: null, skipped: true, reason: "EMAIL_SENDING_ENABLED" };
  }

  const resendKey = getEnv("RESEND_API_KEY");
  const fromEmail =
    getEnv("RESEND_FROM_EMAIL") || "Local Kids Calendar <onboarding@resend.dev>";

  if (!resendKey) {
    throw new Error("Server missing RESEND_API_KEY");
  }
  if (!to || !subject || !html) {
    throw new Error("to, subject, and html are required");
  }

  const body = {
    from: fromEmail,
    to: [to],
    subject,
    html,
  };
  if (replyTo) body.reply_to = replyTo;

  if (headers) {
    if (Array.isArray(headers)) {
      body.headers = Object.fromEntries(headers.map((h) => [h.name, h.value]));
    } else {
      body.headers = headers;
    }
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    throw new Error(payload?.message || `Resend failed (${resendRes.status})`);
  }
  return { id: payload.id || null, skipped: false };
}
