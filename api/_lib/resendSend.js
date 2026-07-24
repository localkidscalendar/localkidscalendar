import { getEnv } from "./stripeHelpers.js";

/**
 * Send an email via Resend from a serverless function (no user JWT required).
 */
export async function sendViaResend({ to, subject, html }) {
  const resendKey = getEnv("RESEND_API_KEY");
  const fromEmail =
    getEnv("RESEND_FROM_EMAIL") || "Local Kids Calendar <onboarding@resend.dev>";

  if (!resendKey) {
    throw new Error("Server missing RESEND_API_KEY");
  }
  if (!to || !subject || !html) {
    throw new Error("to, subject, and html are required");
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  const payload = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    throw new Error(payload?.message || `Resend failed (${resendRes.status})`);
  }
  return { id: payload.id || null };
}
