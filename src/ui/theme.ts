/**
 * The appearance choice. Three states, not two: "system" is the absence of a choice, so the page keeps
 * following the device's light or dark setting until someone picks one. A choice pins `data-theme` on
 * `<html>`, which the colour tokens in globals.css key on, and is remembered in this browser only.
 */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const THEME_KEY = "team-leader:theme";

interface ThemeRoot {
  readonly dataset: Record<string, string | undefined>;
}

interface ThemeStorage {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function parseTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function readTheme(root: ThemeRoot): ThemeChoice {
  return parseTheme(root.dataset.theme);
}

export function applyTheme(choice: ThemeChoice, root: ThemeRoot, storage: ThemeStorage): void {
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

/** Runs in <head> before first paint, so a remembered dark theme never flashes light. Only light or dark is stamped. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
