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

/** Hostname prefixes that require a real domain after them (www.business.com, not www.business). */
const SUBDOMAIN_PREFIXES_REQUIRING_DOMAIN = new Set(["www", "ww", "w"]);

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
 * @param {string} host
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validatePublicHostname(host) {
  const lowered = (host || "").toLowerCase().trim();
  const parts = lowered.split(".").filter(Boolean);

  if (parts.length < 2) {
    return {
      ok: false,
      reason: "Please enter a full website link with a domain name (e.g. https://yourbusiness.com).",
    };
  }

  const tld = parts[parts.length - 1];
  if (!/^[a-z]{2,63}$/i.test(tld)) {
    return {
      ok: false,
      reason: "The destination URL must end with a valid domain (e.g. .com, .org, .net).",
    };
  }

  // www.sftahoe → treats "sftahoe" as TLD; require www.name.tld (3+ labels).
  if (parts.length === 2 && SUBDOMAIN_PREFIXES_REQUIRING_DOMAIN.has(parts[0])) {
    return {
      ok: false,
      reason:
        "Please enter a full website link (e.g. https://www.yourbusiness.com). Links like www.yourbusiness are missing the domain ending (.com, .org, etc.).",
    };
  }

  // bare name.tld — reject implausible single-word “TLDs” (e.g. business.sftahoe).
  if (parts.length === 2 && tld.length > 6) {
    return {
      ok: false,
      reason:
        "The destination URL must end with a real domain extension (e.g. .com, .org, .net).",
    };
  }

  return { ok: true };
}

/**
 * Supporter ad destination URLs must be public http(s) links with a real domain.
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
  const hostCheck = validatePublicHostname(host);
  if (!hostCheck.ok) return hostCheck;

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

/**
 * Optional public website — empty is OK; otherwise same rules as Supporter ad links.
 * @param {string} raw
 * @returns {{ ok: true, normalizedUrl: string } | { ok: false, reason: string }}
 */
export function validateOptionalPublicWebsite(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: true, normalizedUrl: "" };
  return validateBusinessLinkUrl(trimmed);
}

/**
 * Required public website (organizer profile, registration).
 * @param {string} raw
 * @returns {{ ok: true, normalizedUrl: string } | { ok: false, reason: string }}
 */
export function validateRequiredPublicWebsite(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "A website URL is required." };
  }
  return validateBusinessLinkUrl(trimmed);
}
