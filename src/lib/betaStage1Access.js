/** localStorage key for Beta Stage 1 access unlock (browser-level, not account). */
export const BETA_STAGE1_STORAGE_KEY = "beta_stage1_access_code";

export function clearBetaStage1Access() {
  try {
    localStorage.removeItem(BETA_STAGE1_STORAGE_KEY);
  } catch {
    // ignore quota / private-mode errors
  }
}
