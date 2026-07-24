import { supabase } from "@/lib/supabaseClient";

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

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, subject, html }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Email send failed (${res.status})`);
  }

  return { ok: true, id: payload.id || null };
}
