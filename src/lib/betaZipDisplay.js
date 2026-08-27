/** Beta zips that work in filters/checkout but should not appear in public zip lists. */
export const BETA_ZIPS_HIDDEN_FROM_DISPLAY = ["00000"];

export function sortBetaZips(zipCodes) {
  const list = Array.isArray(zipCodes) ? zipCodes : [];
  return [...list].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );
}

/** Public-facing beta zip lists (banner, Home picker, Register note, etc.). */
export function betaZipsForDisplay(zipCodes) {
  const hidden = new Set(BETA_ZIPS_HIDDEN_FROM_DISPLAY.map(String));
  const list = Array.isArray(zipCodes) ? zipCodes : [];
  return sortBetaZips(list.filter((z) => !hidden.has(String(z).trim())));
}

/** True if the zip is allowed under current Stage 2 beta restrictions. */
export function isZipAllowed(zip, betaConfig) {
  if (!betaConfig || !betaConfig.enabled) return true;
  if (!betaConfig.zip_codes || betaConfig.zip_codes.length === 0) return true;
  return betaConfig.zip_codes.includes(String(zip || "").trim());
}

/** Shared copy when a zip is outside the Stage 2 whitelist. */
export function betaZipBlockedCopy(zip) {
  const z = String(zip || "").trim();
  return {
    title: z ? `Zip ${z} isn't in our beta area yet` : "That zip isn't in our beta area yet",
    description: "See the banner at the top of the site for available locations.",
  };
}
