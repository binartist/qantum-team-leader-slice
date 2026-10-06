import { MATERIALS_PATH, penetrationPath, shortSiteCount, uncheckedSiteCount } from "./format";
import { NAV } from "./messages";
import type { StatusView } from "./status";

/**
 * A materials-list row's state (AC 38). Null means the row may say "Not short at any site": only when the
 * stock is known, every site was checked, no site is short alone and the sites together fit the stock.
 */
export function materialState(row: {
  readonly onHandQty: number | null;
  readonly plannedQty: number | null;
  readonly neededSiteCount: number;
  readonly shortSiteCount: number;
  readonly uncheckedSiteCount: number;
}): StatusView | null {
  if (row.onHandQty === null) {
    const where = row.neededSiteCount === 1 ? "1 site" : `${row.neededSiteCount} sites`;
    return { label: `Stock unknown · needed at ${where}`, tone: "warning", icon: "warning" };
  }
  if (row.shortSiteCount > 0) return { label: shortSiteCount(row.shortSiteCount), tone: "danger", icon: "stop" };
  if (row.uncheckedSiteCount > 0) return { label: uncheckedSiteCount(row.uncheckedSiteCount), tone: "warning", icon: "warning" };
  // Stock is shared and not reserved: no site short alone can still mean not enough for all of them.
  if (row.plannedQty !== null && row.plannedQty > row.onHandQty) {
    return { label: "Sites together need more than on hand", tone: "warning", icon: "warning" };
  }
  return null;
}

/** The banner when sites could not be read: their needs are missing from every total. */
export function uncheckedBanner(count: number): string {
  return count === 1 ? "1 site couldn't be checked. Its needs are not counted." : `${uncheckedSiteCount(count)}. Their needs are not counted.`;
}

/** Where a material page's back control goes (AC 42): the penetration it was opened from, else Materials. */
export function materialBack(
  back: { readonly siteId: string; readonly penetrationId: string; readonly floor: string; readonly location: string } | null,
): { readonly href: string; readonly name: string } {
  if (!back) return { href: MATERIALS_PATH, name: NAV.materials };
  return {
    href: penetrationPath(back.siteId, back.penetrationId),
    name: `${back.floor}, ${back.location}`,
  };
}
