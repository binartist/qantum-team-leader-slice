import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function contrast(hexA: string, hexB: string): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const red = channel((n >> 16) & 255);
    const green = channel((n >> 8) & 255);
    const blue = channel(n & 255);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const left = luminance(hexA);
  const right = luminance(hexB);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  const value = match?.[1];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

describe("fixed screen copy", () => {
  it("the sites list has its own unavailable sentence", () => {
    const messages = readFileSync("src/ui/messages.ts", "utf8");
    const page = readFileSync("src/app/sites/page.tsx", "utf8");
    expect(messages).toContain("Can't check the sites right now. Don't assume any site is clear. Try again.");
    expect(page).toContain("SITES_UNAVAILABLE");
    expect(page).not.toContain('readinessBanner("unavailable"');
  });

  it("the substitutes page chooses the empty sentence from whether a decision exists", () => {
    const page = readFileSync("src/app/sites/[id]/penetrations/[pid]/page.tsx", "utf8");
    expect(page).toContain("emptyCatalogueLabel");
  });

  it("a site tab whose site did not resolve still links back to sites", () => {
    const frame = readFileSync("src/app/sites/[id]/site-frame.tsx", "utf8");
    expect(frame).toContain('href: "/sites"');
    expect(frame).toContain('name: "Sites"');
  });

  it("error.tsx copy does not include error.message or the digest value", () => {
    const source = readFileSync("src/app/error.tsx", "utf8");
    expect(source).toContain("Something went wrong");
    expect(source).toContain("Try again.");
    expect(source).not.toContain("error.message");
    expect(source).not.toMatch(/\{error\.digest\}/);
  });

  it("global-error has fixed copy, the header, and a retry, and no message or digest", () => {
    expect(existsSync("src/app/global-error.tsx")).toBe(true);
    const source = readFileSync("src/app/global-error.tsx", "utf8");
    expect(source).not.toContain("<footer");
    expect(source).toContain("Something went wrong");
    expect(source).toContain("Try again.");
    expect(source).toContain("retry");
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.digest");
  });
});

const SCREEN_SOURCES = [
  "src/app/about-this-demo/page.tsx",
  "src/app/sites/page.tsx",
  "src/app/not-found.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/sites/[id]/site-frame.tsx",
  "src/app/sites/[id]/penetrations/[pid]/page.tsx",
  "src/app/materials/page.tsx",
  "src/app/materials/[materialId]/page.tsx",
  "src/app/actions/page.tsx",
];

function linkButtonBlocks(source: string): string[] {
  return source.match(/<LinkButton\b[\s\S]*?<\/LinkButton>/g) ?? [];
}

describe("navigation shell", () => {
  it("has no root Loading screen, so the current page stays until the next one is ready", () => {
    expect(existsSync("src/app/loading.tsx")).toBe(false);
  });

  it("AC 37: top-level pages use MenuBar and inner pages use AppBar, never both", () => {
    for (const file of SCREEN_SOURCES) {
      const source = readFileSync(file, "utf8");
      // AC 37: the leading control is the back control or the menu, never both. The landing page, Sites,
      // Materials and the Actions log carry the menu; inner screens a back control; the error screens have no header.
      const menu = ["src/app/about-this-demo/page.tsx", "src/app/sites/page.tsx", "src/app/materials/page.tsx", "src/app/actions/page.tsx"];
      const noHeader = ["src/app/error.tsx", "src/app/global-error.tsx"];
      if (menu.includes(file)) {
        expect(source, file).toMatch(/<MenuBar current="(sites|materials|actions|about)" \/>/);
        expect(source, file).not.toContain("<AppBar");
      } else if (noHeader.includes(file)) {
        expect(source, file).not.toContain("<AppBar");
        expect(source, file).not.toContain("<MenuBar");
      } else {
        expect(source, file).toMatch(/<AppBar backHref=/);
        expect(source, file).not.toContain("<MenuBar");
      }
      // The title is the page's own h1 inside main, not part of the header.
      expect(source, file).toMatch(/<main[^>]*>\s*(<title>[^<]*<\/title>\s*)?<h1>/);
      expect(source, file).not.toMatch(/<AppBar[^>]*title=/);
      const backBlocks = linkButtonBlocks(source).filter((block) => /backHref|backName/.test(block));
      expect(backBlocks, file).toEqual([]);
    }
  });

  it("AC 47: the root layout renders the side menu beside every page", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("<SideMenu");
    expect(layout).not.toMatch(/<header\b/);
    const menu = readFileSync("src/ui/SideMenu.tsx", "utf8");
    expect(menu).toContain("<aside");
    expect(menu).toContain("navSectionForPath");
    const bar = readFileSync("src/ui/AppBar.tsx", "utf8");
    expect(bar).toContain("data-menu-bar");
    const primitives = readFileSync("src/ui/primitives.module.css", "utf8");
    expect(primitives).toContain("grid-template-columns 150ms");
    expect(primitives).toContain(':global(:root[data-sidebar="collapsed"])');
  });

  it("the root layout has no demo footer and no header, and no screen carries a Demo tag (user decision)", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const bar = readFileSync("src/ui/AppBar.tsx", "utf8");
    expect(layout).not.toContain("<footer");
    expect(bar).not.toMatch(/demo/i);
    expect(layout).not.toMatch(/<header\b/);
  });

  it("shows the job reference on the site screen only, labelled", () => {
    const card = readFileSync("src/ui/SiteCard.tsx", "utf8");
    const site = readFileSync("src/app/sites/[id]/site-frame.tsx", "utf8");
    expect(card).not.toMatch(/reference/i);
    expect(site).toContain("formatReference(site.reference)");
    expect(site).not.toMatch(/\{site\.reference\}/);
  });
});

describe("input contrast", () => {
  it("gives inputs a border of at least 3:1 and a visible invalid border", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    const decisions = readFileSync("src/ui/decisions/decisions.module.css", "utf8");
    const primitives = readFileSync("src/ui/primitives.module.css", "utf8");
    expect(decisions).toContain("var(--input-border)");
    expect(decisions).toContain('[aria-invalid="true"]');
    expect(primitives).toContain(".siteCard span");
    const [light, dark] = globals.split("prefers-color-scheme: dark");
    if (!light || !dark) throw new Error("both themes are required");
    for (const block of [light, dark]) {
      const border = token(block, "--input-border");
      expect(contrast(border, token(block, "--bg"))).toBeGreaterThanOrEqual(3);
      expect(contrast(border, token(block, "--surface"))).toBeGreaterThanOrEqual(3);
      expect(contrast(token(block, "--danger-text"), token(block, "--bg"))).toBeGreaterThanOrEqual(3);
      // Decision colours: readable as a chip and as a bare label on the page.
      for (const tone of ["info", "escalation"]) {
        expect(contrast(token(block, `--${tone}-text`), token(block, `--${tone}-bg`)), tone).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(block, `--${tone}-text`), token(block, "--bg")), tone).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(block, `--${tone}-text`), token(block, "--surface")), tone).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("back links to the list go to /sites, and the landing page leads with the menu", () => {
    for (const file of SCREEN_SOURCES.filter((name) => name !== "src/app/about-this-demo/page.tsx")) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain('backHref="/"');
    }
    const landing = readFileSync("src/app/about-this-demo/page.tsx", "utf8");
    expect(landing).toContain('<MenuBar current="about" />');
    expect(landing).not.toContain("<AppBar");
    expect(landing).not.toContain("Open sites");
  });

  it("the site screen lists penetrations under filter chips, with no blocked banner", () => {
    const page = readFileSync("src/app/sites/[id]/page.tsx", "utf8");
    expect(page).toContain("<SiteFrame");
    expect(page).toContain("<PenetrationFilters");
    const frame = readFileSync("src/app/sites/[id]/site-frame.tsx", "utf8");
    expect(frame).toContain('crewStatus !== "blocked"');
    expect(frame.indexOf("<Banner")).toBeLessThan(frame.indexOf("{children}"));
  });
});
