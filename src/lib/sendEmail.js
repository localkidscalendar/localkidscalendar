import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";

/**
 * Send an email via the admin-only /api/send-email endpoint.
 * Client builds subject/html with buildEmail(); the API only relays to Resend.
 *
 * @param {{ to: string, subject: string, html: string }} opts
 * @returns {Promise<{ ok: true, id: string | null }>}
 */
export async function sendEmail({ to, subject, html }) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error("You must be signed in to send email.");
  }

  const res = await fetch(apiUrl("/api/send-email"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, subject, html }),
  });

  const raw = await res.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const detail = payload.error || (raw && raw.length < 200 ? raw : null);
    throw new Error(detail || `Email send failed (${res.status})`);
  }

  return { ok: true, id: payload.id || null };
}
