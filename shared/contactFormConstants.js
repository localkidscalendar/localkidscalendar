/** Allowed Contact Us subjects (must match Admin contact message boxes). */
export const CONTACT_SUBJECTS = [
  "Report Technical Issues",
  "Submit New Ideas & Suggestions",
  "Inquire About Activity Details",
  "General Questions",
];

/** Honeypot field name sent to /api/contact-submit (must stay empty). */
export const CONTACT_HONEYPOT_FIELD = "website";

/** Minimum ms the form must be open before a real submit (client + server). */
export const CONTACT_MIN_SUBMIT_MS = 2000;

/** Reject timing tokens older than this (stale replay). */
export const CONTACT_MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

export const CONTACT_MAX_MESSAGE_CHARS = 8000;
export const CONTACT_MAX_NAME_CHARS = 200;
export const CONTACT_MAX_EMAIL_CHARS = 320;
export const CONTACT_MAX_PHONE_CHARS = 32;

/** Max contact_messages rows per email address within the rate window. */
export const CONTACT_RATE_LIMIT_MAX = 5;
export const CONTACT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
