/**
 * Shared destination-link checks for Supporter ad assets (client + API).
 * Async reachability (404) stays server-side in creative-review.js.
 */

export const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^\[::1\]$/,
  /^fc00:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

export const UNSAFE_URL_PATTERN =
  /\b(porn|xxx|adult|sex|escort|nude|onlyfans|camgirl|gambling|casino|weed|cocaine|viagra)\b/i;

/** @param {string} hostname */
export function isPrivateOrUnsafeHost(hostname) {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname || ""));
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeLinkUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Supporter ad destination URLs must be public http(s) links with a real domain (contains a dot).
 * @param {string} raw
 * @returns {{ ok: true, normalizedUrl: string } | { ok: false, reason: string }}
 */
export function validateBusinessLinkUrl(raw) {
  const normalizedUrl = normalizeLinkUrl(raw);
  if (!normalizedUrl) {
    return { ok: false, reason: "A destination URL is required." };
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return {
      ok: false,
      reason: "The destination URL is not valid. Please enter a full working link (e.g. https://yourbusiness.com).",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "The destination URL must start with http:// or https://.",
    };
  }

  const host = parsed.hostname || "";
  if (!host.includes(".")) {
    return {
      ok: false,
      reason: "Please enter a full website link with a domain name (e.g. https://yourbusiness.com).",
    };
  }

  const tld = host.split(".").pop() || "";
  if (!/^[a-z]{2,}$/i.test(tld)) {
    return {
      ok: false,
      reason: "The destination URL must end with a valid domain (e.g. .com, .org, .net).",
    };
  }

  if (UNSAFE_URL_PATTERN.test(host + parsed.pathname)) {
    return {
      ok: false,
      reason: "The destination URL appears inappropriate for a family audience. Please use a safe, business-related link.",
    };
  }

  if (isPrivateOrUnsafeHost(host)) {
    return {
      ok: false,
      reason: "The destination URL points to a private or internal address and cannot be used.",
    };
  }

  return { ok: true, normalizedUrl: parsed.href };
}
