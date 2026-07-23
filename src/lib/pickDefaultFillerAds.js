/**
 * Pick Admin Default/Filler ads for empty zip slots.
 * Prefer is_slot_1 → is_slot_2 → is_slot_3 (Base44 order), de-dupe, then trim to emptySlots.
 */
export function pickDefaultFillerAds(defaultAds = [], emptySlots = 0) {
  if (emptySlots <= 0 || !defaultAds.length) return [];

  const slot1 = defaultAds.find((a) => a.is_slot_1);
  const slot2 = defaultAds.find((a) => a.is_slot_2);
  const slot3 = defaultAds.find((a) => a.is_slot_3);
  const ordered = [slot1, slot2, slot3].filter(Boolean);

  const seen = new Set();
  return ordered
    .filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .slice(0, emptySlots);
}
