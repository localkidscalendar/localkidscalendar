/** Register step 3 — after email signup (not Google OAuth). */
export const AUTH_CONFIRMATION_INBOX_HINT =
  "If you don't see our email within a few minutes, check your spam or junk folder.";

export const AUTH_CONFIRMATION_INBOX_HINT_CLASS = "font-bold text-red-600";

/** Shown on Register after email signup, and on Login only if sign-in fails (email not confirmed). */
export const AUTH_EMAIL_SIGNUP_CONFIRM_NOTE =
  "Open the link in our confirmation email, then log in to finish setup.";

/** Login error helper when Supabase rejects unconfirmed email. */
export const AUTH_EMAIL_NOT_CONFIRMED_HELP =
  "Your email address isn't confirmed yet. Open the link in our confirmation email, then try logging in again.";

function isEmailNotConfirmedError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("email not confirmed") || msg.includes("not confirmed");
}

export { isEmailNotConfirmedError };
