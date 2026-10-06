import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_KEY, THEME_SCRIPT, applyTheme, parseTheme, readTheme } from "@/ui/theme";

function fakeRoot(theme?: string): { dataset: Record<string, string | undefined> } {
  return { dataset: theme === undefined ? {} : { theme } };
}

function fakeStorage(fail = false) {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => {
      if (fail) throw new Error("blocked");
      return items.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (fail) throw new Error("blocked");
      items.set(key, value);
    },
    removeItem: (key: string) => {
      if (fail) throw new Error("blocked");
      items.delete(key);
    },
  };
}

describe("AC 37: the theme choice in the side menu", () => {
  it("reads only light or dark as a choice; anything else follows the system", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const value of [null, undefined, "", "system", "Dark", "blue"]) expect(parseTheme(value), String(value)).toBe("system");
    expect(readTheme(fakeRoot("dark"))).toBe("dark");
    expect(readTheme(fakeRoot())).toBe("system");
  });

  it("pins a chosen theme on the page and remembers it; System clears both", () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    applyTheme("dark", root, storage);
    expect(root.dataset.theme).toBe("dark");
    expect(storage.items.get(THEME_KEY)).toBe("dark");
    applyTheme("system", root, storage);
    expect(root.dataset.theme).toBeUndefined();
    expect(storage.items.has(THEME_KEY)).toBe(false);
  });

  it("still applies the theme for this visit when storage is blocked", () => {
    const root = fakeRoot();
    applyTheme("light", root, fakeStorage(true));
    expect(root.dataset.theme).toBe("light");
    applyTheme("system", root, fakeStorage(true));
    expect(root.dataset.theme).toBeUndefined();
  });

  it("stamps the remembered choice before first paint, and survives blocked storage", () => {
    const run = (storage: ReturnType<typeof fakeStorage>) => {
      const root = fakeRoot();
      new Function("document", "localStorage", THEME_SCRIPT)({ documentElement: root }, storage);
      return root.dataset.theme;
    };
    const saved = fakeStorage();
    saved.items.set(THEME_KEY, "dark");
    expect(run(saved)).toBe("dark");
    const junk = fakeStorage();
    junk.items.set(THEME_KEY, "<img>");
    expect(run(junk)).toBeUndefined();
    expect(run(fakeStorage(true))).toBeUndefined();
  });

  it("keeps the chosen-dark tokens identical to the system-dark ones", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const tokens = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, selector).toBeGreaterThan(-1);
      const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
      return body.split("\n").map((line) => line.trim()).filter(Boolean);
    };
    const system = tokens(':root:not([data-theme="light"])');
    expect(system.length).toBeGreaterThan(20);
    expect(tokens(':root[data-theme="dark"]')).toEqual(system);
  });
});
