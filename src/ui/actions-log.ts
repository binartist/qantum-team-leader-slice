import { ACTIONS_PATH, siteAnchor } from "./format";
import { NAV } from "./messages";

/**
 * The site a page was opened from in the actions log (`?fromLog=`), when it is one this page belongs to.
 * A missing, repeated or foreign value is ignored, so the back control falls back to the page's parent.
 */
export function logOrigin(value: string | string[] | undefined, siteIds: readonly string[]): string | undefined {
  return typeof value === "string" && siteIds.includes(value) ? value : undefined;
}

/** The back control to the actions log, at the section the page was opened from. */
export function logBack(siteId: string): { readonly href: string; readonly name: string } {
  return { href: `${ACTIONS_PATH}#${encodeURIComponent(siteAnchor(siteId))}`, name: NAV.actions };
}
