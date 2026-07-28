/**
 * React Router's Browser history entries include an `idx` in history.state.
 * Direct loads / shared links start at idx 0 — no in-app prior page to return to.
 */
export function canNavigateBack() {
  if (typeof window === "undefined") return false;
  const idx = window.history.state?.idx;
  if (typeof idx === "number") return idx > 0;
  return false;
}
