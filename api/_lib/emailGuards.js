import crypto from "crypto";
import { getEnv } from "./stripeHelpers.js";

const APP_URL = process.env.VITE_APP_URL || "https://localkidscalendar.com";

/** Master env kill switch for ALL Resend sends. Default: enabled. */
export function isEmailSendingEnabled() {
  const raw = (getEnv("EMAIL_SENDING_ENABLED") || "true").trim().toLowerCase();
  return !(raw === "false" || raw === "0" || raw === "off" || raw === "no");
}

function unsubSecret() {
  return (
    getEnv("UNSUBSCRIBE_SECRET") ||
    getEnv("CRON_SECRET") ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    "local-dev-unsub"
  );
}

export function makeDigestUnsubToken(userId) {
  if (!userId) return "";
  const sig = crypto.createHmac("sha256", unsubSecret()).update(String(userId)).digest("base64url");
  return `${userId}.${sig}`;
}

export function verifyDigestUnsubToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const idx = token.indexOf(".");
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!userId || !sig) return null;
  const expected = crypto.createHmac("sha256", unsubSecret()).update(userId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export function digestUnsubscribeUrl(userId) {
  const token = makeDigestUnsubToken(userId);
  return `${APP_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function digestUnsubscribeApiUrl(userId) {
  const token = makeDigestUnsubToken(userId);
  return `${APP_URL}/api/unsubscribe-digest?token=${encodeURIComponent(token)}`;
}

export async function loadEmailConfig(admin) {
  const { data } = await admin
    .from("email_config")
    .select("*")
    .eq("config_key", "global")
    .maybeSingle();
  return {
    digests_paused: Boolean(data?.digests_paused),
    inactivity_days: Number(data?.inactivity_days) > 0 ? Number(data.inactivity_days) : 90,
    max_sends_per_run: Number(data?.max_sends_per_run) > 0 ? Number(data.max_sends_per_run) : 200,
    paused_at: data?.paused_at || null,
    raw: data || null,
  };
}

export async function isEmailSuppressed(admin, email) {
  if (!email) return false;
  const needle = String(email).trim().toLowerCase();
  const { data } = await admin
    .from("email_suppressions")
    .select("id")
    .eq("email", needle)
    .maybeSingle();
  return Boolean(data);
}

/** Prefer exact lowercase match; used when inserting. */
export async function upsertEmailSuppression(admin, { email, userId = null, reason, detail = null }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const { data: existing } = await admin
    .from("email_suppressions")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (existing) {
    await admin
      .from("email_suppressions")
      .update({ reason, detail, user_id: userId || null })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await admin
    .from("email_suppressions")
    .insert({
      email: normalized,
      user_id: userId || null,
      reason,
      detail,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

/** True if a digest was already sent in the last ~6 days (covers weekly Tuesday cron retries). */
export function alreadySentDigestThisWeek(lastDigestSentAt, now = new Date()) {
  if (!lastDigestSentAt) return false;
  const sent = new Date(lastDigestSentAt).getTime();
  if (Number.isNaN(sent)) return false;
  return now.getTime() - sent < 6 * 24 * 60 * 60 * 1000;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
