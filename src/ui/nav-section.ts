import { ABOUT_PATH } from "./format";

export type NavSection = "sites" | "materials" | "actions" | "about";

/** Which menu entry is the current page. Anything outside the four sections is none. */
export function navSectionForPath(pathname: string): NavSection | "none" {
  if (pathname === ABOUT_PATH) return "about";
  if (pathname === "/sites" || pathname.startsWith("/sites/")) return "sites";
  if (pathname === "/materials" || pathname.startsWith("/materials/")) return "materials";
  if (pathname === "/actions") return "actions";
  return "none";
}
