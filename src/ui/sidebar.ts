import { THEME_SCRIPT } from "./theme";

/** Expanded is the absence of a choice, same shape as the theme's "system". */
export type SidebarState = "expanded" | "collapsed";

export const SIDEBAR_KEY = "team-leader:sidebar";

interface SidebarRoot {
  readonly dataset: Record<string, string | undefined>;
}

interface SidebarStorage {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function parseSidebar(value: string | null | undefined): SidebarState {
  return value === "collapsed" ? "collapsed" : "expanded";
}

export function readSidebar(root: SidebarRoot): SidebarState {
  return parseSidebar(root.dataset.sidebar);
}

export function applySidebar(state: SidebarState, root: SidebarRoot, storage: SidebarStorage): void {
  if (state === "collapsed") root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  try {
    if (state === "collapsed") storage.setItem(SIDEBAR_KEY, "collapsed");
    else storage.removeItem(SIDEBAR_KEY);
  } catch {
    // Storage blocked: the menu still collapses for this visit.
  }
}

/** Runs in <head> before first paint, so a remembered collapsed menu never flashes open. */
export const SIDEBAR_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)});if(s==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

/** Theme and sidebar together. The layout keeps them in one inline script. */
export const HEAD_SCRIPT = `${THEME_SCRIPT}${SIDEBAR_SCRIPT}`;
