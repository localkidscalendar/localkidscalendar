import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_MAX_FORM_AGE_MS,
  CONTACT_MAX_MESSAGE_CHARS,
  CONTACT_MAX_NAME_CHARS,
  CONTACT_MAX_EMAIL_CHARS,
  CONTACT_MAX_PHONE_CHARS,
  CONTACT_MIN_SUBMIT_MS,
  CONTACT_RATE_LIMIT_MAX,
  CONTACT_RATE_LIMIT_WINDOW_MS,
  CONTACT_SUBJECTS,
} from "../../shared/contactFormConstants.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @returns {{ ok: true, payload: object } | { ok: false, bot: boolean, error?: string }}
 */
export function parseContactSubmitBody(body) {
  const raw = body && typeof body === "object" ? body : {};
  const honeypot = String(raw[CONTACT_HONEYPOT_FIELD] ?? raw.website ?? "").trim();
  const formLoadedAt = Number(raw.form_loaded_at ?? raw.formLoadTime);

  if (honeypot) {
    return { ok: false, bot: true };
  }

  const elapsed = Date.now() - formLoadedAt;
  if (!Number.isFinite(formLoadedAt) || elapsed < CONTACT_MIN_SUBMIT_MS || elapsed > CONTACT_MAX_FORM_AGE_MS) {
    return { ok: false, bot: true };
  }

  const sender_name = String(raw.sender_name ?? "").trim().slice(0, CONTACT_MAX_NAME_CHARS);
  const sender_email = String(raw.sender_email ?? "").trim().slice(0, CONTACT_MAX_EMAIL_CHARS);
  const sender_phone = String(raw.sender_phone ?? "").trim().slice(0, CONTACT_MAX_PHONE_CHARS);
  const subject = String(raw.subject ?? "").trim();
  const message = String(raw.message ?? "").trim().slice(0, CONTACT_MAX_MESSAGE_CHARS);
  const turnstile_token = String(raw.turnstile_token ?? raw.turnstileToken ?? "").trim();

  if (!subject || !CONTACT_SUBJECTS.includes(subject)) {
    return { ok: false, bot: false, error: "Please choose a valid subject." };
  }
  if (!message) {
    return { ok: false, bot: false, error: "Message is required." };
  }
  if (!sender_name || !sender_email || !EMAIL_RE.test(sender_email)) {
    return { ok: false, bot: false, error: "Valid name and email are required." };
  }

  return {
    ok: true,
    payload: {
      sender_name,
      sender_email,
      sender_phone,
      subject,
      message,
      turnstile_token,
    },
  };
}

export async function isContactRateLimited(admin, senderEmail) {
  const email = String(senderEmail || "").trim().toLowerCase();
  if (!email) return false;
  const since = new Date(Date.now() - CONTACT_RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_email", email)
    .gte("created_at", since);
  if (error) {
    console.error("contact rate limit check failed:", error.message);
    return false;
  }
  return (count || 0) >= CONTACT_RATE_LIMIT_MAX;
}
