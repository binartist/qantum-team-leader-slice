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
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(messages).toContain("Can't check the sites right now. Don't assume any site is clear. Try again.");
    expect(page).toContain("SITES_UNAVAILABLE");
    expect(page).not.toContain('readinessBanner("unavailable"');
  });

  it("the substitutes page chooses the empty sentence from whether a decision exists", () => {
    const page = readFileSync("src/app/sites/[id]/penetrations/[pid]/page.tsx", "utf8");
    expect(page).toContain("emptyCatalogueLabel");
  });

  it("an actions page whose site did not resolve still links back to sites", () => {
    const page = readFileSync("src/app/sites/[id]/actions/page.tsx", "utf8");
    expect(page).toContain("BUTTONS.backToSites");
  });

  it("error.tsx copy does not include error.message or the digest value", () => {
    const source = readFileSync("src/app/error.tsx", "utf8");
    expect(source).toContain("Something went wrong");
    expect(source).toContain("Try again.");
    expect(source).not.toContain("error.message");
    expect(source).not.toMatch(/\{error\.digest\}/);
  });

  it("global-error has fixed copy, the demo banner, and a retry, and no message or digest", () => {
    expect(existsSync("src/app/global-error.tsx")).toBe(true);
    const source = readFileSync("src/app/global-error.tsx", "utf8");
    expect(source).toContain("Demo: sample data, no login");
    expect(source).toContain("Something went wrong");
    expect(source).toContain("Try again.");
    expect(source).toContain("retry");
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.digest");
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
    }
  });
});
