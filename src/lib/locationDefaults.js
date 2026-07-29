export const DEFAULT_RADIUS_MILES = 15;
export const RADIUS_OPTIONS = [5, 10, 15, 25, 50, 100];

export function normalizeRadiusMiles(value, fallback = DEFAULT_RADIUS_MILES) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
