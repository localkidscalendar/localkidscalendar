/** Maximum age for kids' activities on Local Kids Calendar (inclusive). */
export const MAX_KIDS_ACTIVITY_AGE = 18;

/**
 * Clamp a numeric age string while typing in activity age fields.
 * Empty stays empty; values above MAX_KIDS_ACTIVITY_AGE become "18".
 */
export function clampActivityAgeInput(value) {
  if (value === "" || value == null) return "";
  const trimmed = String(value).trim();
  if (trimmed === "") return "";
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return trimmed;
  if (num > MAX_KIDS_ACTIVITY_AGE) return String(MAX_KIDS_ACTIVITY_AGE);
  if (num < 0) return "0";
  return trimmed;
}

/** Clamp a stored numeric age (save/submit). Returns null for empty/invalid. */
export function clampActivityAgeNumber(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > MAX_KIDS_ACTIVITY_AGE) return MAX_KIDS_ACTIVITY_AGE;
  if (num < 0) return 0;
  return Math.floor(num);
}
