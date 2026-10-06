import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Kind icons say what a thing is. They must never be mistaken for a status (can go, blocked, warning, no decision).
const KINDS = ["site", "material", "solution", "decision", "penetration", "about"] as const;
const STATUS_SHAPES = ["check", "stop", "warning", "dashed-circle"];

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

describe("kind icons", () => {
  const source = readFileSync("src/ui/KindIcon.tsx", "utf8");
  const css = readFileSync("src/ui/primitives.module.css", "utf8");

  it("draws every kind, decorative only, and none of the status shapes", () => {
    for (const kind of KINDS) expect(source, kind).toContain(`"${kind}"`);
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('focusable="false"');
    for (const shape of STATUS_SHAPES) expect(source, shape).not.toContain(`"${shape}"`);
    expect(source).not.toMatch(/<circle\b(?![^>]*r="0\.\d)/);
  });

  it("is outlined in the secondary text colour, never a status colour", () => {
    const block = rule(css, ".kindIcon");
    expect(block).toContain("color: var(--text-secondary)");
    expect(block).not.toMatch(/success|danger|warning/);
    expect(source).not.toMatch(/fill="currentColor"(?![^>]*r="0\.\d)/);
  });

  it("marks sites, materials, solutions, decisions and penetrations where they are named", () => {
    const uses: [string, string][] = [
      ["src/ui/SiteCard.tsx", 'kind="site"'],
      ["src/app/materials/[materialId]/page.tsx", 'kind="site"'],
      ["src/app/materials/[materialId]/page.tsx", 'kind="penetration"'],
      ["src/app/materials/page.tsx", 'kind="material"'],
      ["src/ui/SubstituteSwitcher.tsx", 'kind="solution"'],
      ["src/ui/ActionRow.tsx", 'kind="decision"'],
      ["src/app/sites/[id]/penetrations/[pid]/page.tsx", 'kind="solution"'],
      ["src/ui/PenetrationGroups.tsx", 'kind="penetration"'],
      ["src/ui/NavDrawer.tsx", 'kind="about"'],
    ];
    for (const [file, use] of uses) expect(readFileSync(file, "utf8"), `${file} ${use}`).toContain(use);
  });

  it("stays off the filter chips, the actions panel, banners and status chips", () => {
    for (const file of ["src/ui/PenetrationFilters.tsx", "src/ui/ActionsDrawer.tsx", "src/ui/Banner.tsx", "src/ui/StatusChip.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toContain("KindIcon");
    }
  });
});
