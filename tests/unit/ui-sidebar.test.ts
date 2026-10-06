import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_KEY } from "@/ui/theme";
import { HEAD_SCRIPT, SIDEBAR_KEY, applySidebar, parseSidebar, readSidebar } from "@/ui/sidebar";

function fakeRoot(sidebar?: string): { dataset: Record<string, string | undefined> } {
  return { dataset: sidebar === undefined ? {} : { sidebar } };
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

describe("AC 47: the side menu collapse is remembered like the theme", () => {
  it("reads only the exact collapsed value; anything else stays expanded", () => {
    expect(parseSidebar("collapsed")).toBe("collapsed");
    for (const value of [null, undefined, "", "expanded", "Collapsed", "true"]) expect(parseSidebar(value), String(value)).toBe("expanded");
    expect(readSidebar(fakeRoot("collapsed"))).toBe("collapsed");
    expect(readSidebar(fakeRoot("expanded"))).toBe("expanded");
    expect(readSidebar(fakeRoot())).toBe("expanded");
  });

  it("pins collapsed on the page and remembers it; expanded clears both", () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    applySidebar("collapsed", root, storage);
    expect(root.dataset.sidebar).toBe("collapsed");
    expect(storage.items.get(SIDEBAR_KEY)).toBe("collapsed");
    applySidebar("expanded", root, storage);
    expect(root.dataset.sidebar).toBeUndefined();
    expect(storage.items.has(SIDEBAR_KEY)).toBe(false);
  });

  it("still applies the choice for this visit when storage is blocked", () => {
    const root = fakeRoot();
    applySidebar("collapsed", root, fakeStorage(true));
    expect(root.dataset.sidebar).toBe("collapsed");
    applySidebar("expanded", root, fakeStorage(true));
    expect(root.dataset.sidebar).toBeUndefined();
  });

  it("stamps a collapsed menu before first paint, and survives blocked storage", () => {
    const run = (storage: ReturnType<typeof fakeStorage>) => {
      const root = fakeRoot();
      new Function("document", "localStorage", HEAD_SCRIPT)({ documentElement: root }, storage);
      return root.dataset;
    };
    const saved = fakeStorage();
    saved.items.set(SIDEBAR_KEY, "collapsed");
    saved.items.set(THEME_KEY, "dark");
    const stamped = run(saved);
    expect(stamped.sidebar).toBe("collapsed");
    expect(stamped.theme).toBe("dark");

    const junk = fakeStorage();
    junk.items.set(SIDEBAR_KEY, "expanded");
    expect(run(junk).sidebar).toBeUndefined();
    expect(run(fakeStorage(true)).sidebar).toBeUndefined();
  });

  it("hides the empty wide header by zeroing its sticky offset", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@media \(min-width: 1024px\) \{[^}]*:root:has\(\[data-menu-bar\]\)[^}]*--app-bar-height:\s*0;/s);
  });
});
