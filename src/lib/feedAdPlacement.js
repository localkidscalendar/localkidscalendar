/**
 * Homepage feed ad placement (cards + desktop list).
 *
 * ≤3 ads: cards = one ad in each of the first 3 logical rows; list = one row after the 3rd activity.
 * 4+: waves of up to 3 ads with a content gap between waves (cards: 1 content-only row;
 * list: 6 activities) so ads stay near the top without crowding the feed.
 *
 * Mobile always uses cards (list is lg+ only). Logical rows are built for 3 columns, then
 * flattened into grid-cols-1 / sm:2 / lg:3 — stacking on phone keeps the same order.
 */

export const CARD_COLS = 3;
/** Interleave when at least one full card row of activities (otherwise ads append after events). */
export const CARD_MIN_EVENTS_TO_INTERLEAVE = CARD_COLS;
/** Ad-rows per wave, then one content-only row. */
export const CARD_AD_ROWS_PER_WAVE = 3;
export const CARD_CONTENT_GAP_ROWS = 1;

export const LIST_FIRST_AD_AFTER = 3;
export const LIST_ADS_PER_ROW = 3;
export const LIST_ACTIVITIES_BETWEEN_AD_ROWS = 6;

/**
 * @param {object[]} events
 * @param {object[]} ads - rotated { type, ad } items
 * @param {number} rotationIndex
 * @returns {{ type: 'event'|'ad', data: object }[]}
 */
export function buildCardFeedItems(events, ads, rotationIndex = 0) {
  const eventList = Array.isArray(events) ? events : [];
  const adList = Array.isArray(ads) ? ads : [];

  if (adList.length === 0) {
    return eventList.map((data) => ({ type: "event", data }));
  }

  if (eventList.length < CARD_MIN_EVENTS_TO_INTERLEAVE) {
    return [
      ...eventList.map((data) => ({ type: "event", data })),
      ...adList.map((data) => ({ type: "ad", data })),
    ];
  }

  const cycle = CARD_AD_ROWS_PER_WAVE + CARD_CONTENT_GAP_ROWS;
  const rows = [];
  let eventIdx = 0;
  let adIdx = 0;
  let rowNum = 0;
  let adRowsPlaced = 0;
  const safety = eventList.length + adList.length + 20;

  while ((eventIdx < eventList.length || adIdx < adList.length) && rowNum < safety) {
    if (eventIdx >= eventList.length) {
      while (adIdx < adList.length) {
        rows.push([{ type: "ad", data: adList[adIdx++] }]);
      }
      break;
    }

    const cyclePos = rowNum % cycle;
    const injectAd = cyclePos < CARD_AD_ROWS_PER_WAVE && adIdx < adList.length;
    const adCol = injectAd ? (rotationIndex + adRowsPlaced) % CARD_COLS : -1;
    const row = [];
    let colsFilled = 0;
    let placedAdInRow = false;

    for (let col = 0; col < CARD_COLS; col++) {
      if (col === adCol && adIdx < adList.length) {
        row.push({ type: "ad", data: adList[adIdx++] });
        colsFilled++;
        placedAdInRow = true;
      } else if (eventIdx < eventList.length) {
        row.push({ type: "event", data: eventList[eventIdx++] });
        colsFilled++;
      }
    }

    if (placedAdInRow) adRowsPlaced++;
    if (colsFilled === 0) break;
    rows.push(row);
    rowNum++;
  }

  return rows.flat();
}

/**
 * @param {object[]} events
 * @param {object[]} ads - rotated { type, ad } items
 * @returns {{ type: 'events'|'ads', items: object[] }[]}
 */
export function buildListFeedSegments(events, ads) {
  const eventList = Array.isArray(events) ? events : [];
  const adList = Array.isArray(ads) ? ads : [];

  if (adList.length === 0) {
    return eventList.length ? [{ type: "events", items: eventList }] : [];
  }

  const segments = [];
  let eventIdx = 0;
  let adIdx = 0;

  const firstCount = Math.min(LIST_FIRST_AD_AFTER, eventList.length);
  if (firstCount > 0) {
    segments.push({ type: "events", items: eventList.slice(0, firstCount) });
    eventIdx = firstCount;
  }

  const pushAdRow = () => {
    if (adIdx >= adList.length) return false;
    const chunk = adList.slice(adIdx, adIdx + LIST_ADS_PER_ROW);
    segments.push({ type: "ads", items: chunk });
    adIdx += chunk.length;
    return true;
  };

  pushAdRow();

  while (adIdx < adList.length || eventIdx < eventList.length) {
    if (adIdx >= adList.length) {
      segments.push({ type: "events", items: eventList.slice(eventIdx) });
      break;
    }

    const gap = eventList.slice(eventIdx, eventIdx + LIST_ACTIVITIES_BETWEEN_AD_ROWS);
    if (gap.length > 0) {
      segments.push({ type: "events", items: gap });
      eventIdx += gap.length;
    }

    pushAdRow();

    if (gap.length === 0) {
      while (adIdx < adList.length) pushAdRow();
      break;
    }
  }

  return segments;
}
