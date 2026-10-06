/** sessionStorage key for Beta Stage 1 unlock (this browser session only). */
export const BETA_STAGE1_STORAGE_KEY = "beta_stage1_access_code";

/** Remove legacy localStorage unlock from before session-scoped Stage 1. */
function clearLegacyLocalUnlock() {
  try {
    localStorage.removeItem(BETA_STAGE1_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getBetaStage1Access() {
  clearLegacyLocalUnlock();
  try {
    return sessionStorage.getItem(BETA_STAGE1_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setBetaStage1Access(code) {
  clearLegacyLocalUnlock();
  try {
    sessionStorage.setItem(BETA_STAGE1_STORAGE_KEY, code);
  } catch {
    // ignore quota / private-mode errors
  }
}

export function clearBetaStage1Access() {
  clearLegacyLocalUnlock();
  try {
    sessionStorage.removeItem(BETA_STAGE1_STORAGE_KEY);
  } catch {
    // ignore
  }
}
