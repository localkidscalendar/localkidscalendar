// Shared helper to block SSRF attempts against internal/private network destinations
// before performing a server-side fetch to a user-supplied URL.
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local / cloud metadata (e.g. AWS 169.254.169.254)
  /^::1$/,
  /^\[::1\]$/,
  /^fc00:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

export function isPrivateOrUnsafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true; // unparsable — treat as unsafe
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const hostname = parsed.hostname;
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}