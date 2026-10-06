import { sitePath } from "./format";

/** Chips on the site screen. Order is the order in the URL and on the page. */
export const SHOW_FILTERS = ["shortages", "data-problems", "acted"] as const;

export type ShowFilter = (typeof SHOW_FILTERS)[number];

/** Older links used two chips for the same fact. Both select Acted. */
const LEGACY_SHOW: Record<string, ShowFilter> = { escalated: "acted", waited: "acted" };

export interface FilterShortage {
  readonly state: string;
  readonly penetrationIds: readonly string[];
}

export interface FilterBlocker {
  readonly penetrationId: string;
  readonly state: string;
}

/** Keeps only known chips, in page order, ignoring repeats and anything else in the query. */
export function parseShow(value: string | string[] | undefined): ShowFilter[] {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const picked = new Set<ShowFilter>();
  for (const item of raw) {
    if ((SHOW_FILTERS as readonly string[]).includes(item)) picked.add(item as ShowFilter);
    else {
      const legacy = LEGACY_SHOW[item];
      if (legacy !== undefined) picked.add(legacy);
    }
  }
  return SHOW_FILTERS.filter((filter) => picked.has(filter));
}

/** Every `material` value, so a repeated key is preserved rather than collapsed into one id. */
export function materialValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * One penetration matches a chip when that fact is true of it. Unknown stock is a shortage. Acted means a
 * wait or an escalation on a shortage that lists it or on its own data problem, or a substitute proposed for it
 * (`proposed`). None of these is "ready".
 */
export function penetrationMatches(
  penetrationId: string,
  filter: ShowFilter,
  shortages: readonly FilterShortage[],
  blockers: readonly FilterBlocker[],
  proposed: ReadonlySet<string> = new Set(),
): boolean {
  if (filter === "shortages") return shortages.some((shortage) => shortage.penetrationIds.includes(penetrationId));
  if (filter === "data-problems") return blockers.some((blocker) => blocker.penetrationId === penetrationId);
  const acted = (state: string) => state === "escalated" || state === "waiting";
  const shortageHit = shortages.some((shortage) => acted(shortage.state) && shortage.penetrationIds.includes(penetrationId));
  const blockerHit = blockers.some((blocker) => acted(blocker.state) && blocker.penetrationId === penetrationId);
  return shortageHit || blockerHit || proposed.has(penetrationId);
}

/** No chip selected means the whole list. Otherwise a penetration is kept when any selected chip matches it. */
export function matchingPenetrations<T extends { readonly id: string }>(
  places: readonly T[],
  selected: readonly ShowFilter[],
  shortages: readonly FilterShortage[],
  blockers: readonly FilterBlocker[],
  proposed: ReadonlySet<string> = new Set(),
): readonly T[] {
  if (selected.length === 0) return places;
  return places.filter((place) => selected.some((filter) => penetrationMatches(place.id, filter, shortages, blockers, proposed)));
}

/** How many penetrations match each chip, counted on the full list, including zero. */
export function filterCounts(
  places: readonly { readonly id: string }[],
  shortages: readonly FilterShortage[],
  blockers: readonly FilterBlocker[],
  proposed: ReadonlySet<string> = new Set(),
): Record<ShowFilter, number> {
  const counts: Record<ShowFilter, number> = { shortages: 0, "data-problems": 0, acted: 0 };
  for (const place of places) {
    for (const filter of SHOW_FILTERS) {
      if (penetrationMatches(place.id, filter, shortages, blockers, proposed)) counts[filter] += 1;
    }
  }
  return counts;
}

/**
 * Toggles one chip and keeps the others, plus any material filter and where this site was opened from (a
 * material page, or the actions log), so the back control still returns there.
 */
export function showFilterHref(
  siteId: string,
  selected: readonly ShowFilter[],
  toggle: ShowFilter,
  material: readonly string[] = [],
  fromMaterial?: string,
  fromLog?: string,
): string {
  const next = new Set(selected);
  if (next.has(toggle)) next.delete(toggle);
  else next.add(toggle);
  const parts: string[] = [];
  for (const filter of SHOW_FILTERS) {
    if (next.has(filter)) parts.push(`show=${encodeURIComponent(filter)}`);
  }
  for (const value of material) parts.push(`material=${encodeURIComponent(value)}`);
  if (fromMaterial !== undefined && fromMaterial.length > 0) parts.push(`fromMaterial=${encodeURIComponent(fromMaterial)}`);
  if (fromLog !== undefined && fromLog.length > 0) parts.push(`fromLog=${encodeURIComponent(fromLog)}`);
  const query = parts.join("&");
  return query.length === 0 ? sitePath(siteId) : `${sitePath(siteId)}?${query}`;
}
