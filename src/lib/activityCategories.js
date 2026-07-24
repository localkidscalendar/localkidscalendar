/** Shared activity Category options (Home filters, Post Activity, badges, digests). */

export const ACTIVITY_CATEGORIES = [
  { value: "camp", label: "Camps" },
  { value: "childcare_enrichment", label: "Childcare & Enrichment" },
  { value: "classes_lessons", label: "Classes & Lessons" },
  { value: "community", label: "Community" },
  { value: "events_experiences", label: "Events & Experiences" },
  { value: "sports_teams", label: "Sports & Teams" },
];

export const ACTIVITY_CATEGORY_VALUES = ACTIVITY_CATEGORIES.map((c) => c.value);

const LEGACY_CATEGORY_MAP = {
  camp: "camp",
  class: "classes_lessons",
  event: "events_experiences",
  sport: "sports_teams",
  general_interest: "community",
  camps: "camp",
  classes_lessons: "classes_lessons",
  childcare_enrichment: "childcare_enrichment",
  community: "community",
  events_experiences: "events_experiences",
  sports_teams: "sports_teams",
};

export function normalizeCategoryValue(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return LEGACY_CATEGORY_MAP[key] || (ACTIVITY_CATEGORY_VALUES.includes(key) ? key : null);
}

export function normalizeCategoryList(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out = [];
  for (const item of list) {
    const n = normalizeCategoryValue(item);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function categoryLabel(value) {
  const n = normalizeCategoryValue(value) || value;
  return ACTIVITY_CATEGORIES.find((c) => c.value === n)?.label || String(value || "Activity");
}

/** True when marked free, or legacy cost text looks free. */
export function isActivityFree(event) {
  if (!event) return false;
  if (event.is_free === true) return true;
  if (event.is_free === false) return false;
  const cost = String(event.cost || "").trim().toLowerCase();
  if (!cost) return false;
  return /^(free|no cost|\$0(\.00)?)$/i.test(cost) || cost.includes("free");
}
