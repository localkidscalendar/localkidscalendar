// BETA MODE — temporary controls.
// Until BetaConfig lives in Supabase, treat beta restrictions as off.
export default function useBetaConfig() {
  return { enabled: false, zip_codes: [], loading: false };
}

export function isZipAllowed(zip, betaConfig) {
  if (!betaConfig || !betaConfig.enabled) return true;
  if (!betaConfig.zip_codes || betaConfig.zip_codes.length === 0) return true;
  return betaConfig.zip_codes.includes(zip);
}
