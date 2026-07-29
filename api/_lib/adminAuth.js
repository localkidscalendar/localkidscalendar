/** Emails always treated as admin (matches SQL promotion migrations). */
export const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);

/**
 * True if profile/auth identity is an admin operator.
 * @param {{ role?: string|null, email?: string|null }|null|undefined} profile
 * @param {string} [fallbackEmail] auth user email if profile.email is empty
 */
export function isAdminCaller(profile, fallbackEmail = "") {
  const role = String(profile?.role || "").trim();
  const email = String(profile?.email || fallbackEmail || "")
    .trim()
    .toLowerCase();
  return role === "admin" || ADMIN_EMAILS.has(email);
}
