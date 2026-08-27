import { apiUrl } from "@/lib/apiBase";
import { TURNSTILE_HONEYPOT_FIELD } from "../../shared/turnstileFormConstants.js";

/**
 * Server-side Turnstile + honeypot + timing gate before Register / reactivation.
 * @param {{ action: string, token: string, honeypot?: string, formLoadedAt: number }} opts
 */
export async function assertTurnstilePassed({
  action,
  token,
  honeypot = "",
  formLoadedAt,
}) {
  const res = await fetch(apiUrl("/api/verify-turnstile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      turnstile_token: token || "",
      [TURNSTILE_HONEYPOT_FIELD]: honeypot,
      form_loaded_at: formLoadedAt,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Security check failed. Please try again.");
  }
  return data;
}
