import { expect, test, type Page } from "@playwright/test";
import { assertNoOverflow, assertTargets, gotoApp } from "./support";

// Read-only. Runs before the write project, so no actions are recorded yet.

async function expectTabs(page: Page, current: string, counts: [string, string, string]) {
  const nav = page.getByRole("navigation", { name: "Site sections" });
  const [shortages, problems, actions] = counts;
  await expect(nav.getByRole("link", { name: `Shortages ${shortages}` })).toBeVisible();
  await expect(nav.getByRole("link", { name: `Data problems ${problems}` })).toBeVisible();
  await expect(nav.getByRole("link", { name: `Actions log ${actions}` })).toBeVisible();
  await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
  await expect(nav.locator("[aria-current='page']")).toContainText(current);
}

test("site tabs keep the blocked banner above them, carry counts, and each tab has its own URL", async ({ page }) => {
  // AC 34: the banner is short on every tab; the tab counts carry the detail.
  const banner = "Blocked: hold the crew.";

  await gotoApp(page, "/sites/site-c");
  await expect(page.getByText(banner)).toBeVisible();
  await expect(page.locator("main p").filter({ hasText: "Job ref KW-P2" })).toHaveText(/^Job ref KW-P2\s*5 penetrations, 5 solutions$/);
  await expectTabs(page, "Shortages", ["1", "4", "0"]);
  await expect(page.getByRole("heading", { name: "Fire mastic tube" })).toBeVisible();
  await expect(page.getByText("Solution code 9999 isn't in the catalogue")).toHaveCount(0);
  await assertTargets(page);
  await assertNoOverflow(page);

  await page.getByRole("navigation", { name: "Site sections" }).getByRole("link", { name: /^Data problems/ }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\/data-problems$/);
  await expect(page.getByText(banner)).toBeVisible();
  await expectTabs(page, "Data problems", ["1", "4", "0"]);
  await expect(page.getByText("Solution code 9999 isn't in the catalogue")).toBeVisible();
  await expect(page.getByText("No materials recorded for solution 0393")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fire mastic tube" })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Site sections" }).getByRole("link", { name: /^Actions log/ }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\/actions$/);
  await expect(page.getByText(banner)).toBeVisible();
  await expectTabs(page, "Actions log", ["1", "4", "0"]);
  await expect(page.getByText("Nothing recorded for this site yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sites" })).toBeVisible();
});

test("empty tabs say so, and a clear site still reads Crew can go on every tab", async ({ page }) => {
  await gotoApp(page, "/sites/site-a/data-problems");
  await expect(page.getByText("Crew can go")).toBeVisible();
  await expectTabs(page, "Data problems", ["0", "0", "0"]);
  await expect(page.getByText("No data problems.")).toBeVisible();

  await gotoApp(page, "/sites/site-a");
  await expect(page.getByText("No shortages.")).toBeVisible();
  // A clear site says what was checked.
  await expect(page.locator("main p").filter({ hasText: "Job ref RP-A2" })).toHaveText(/^Job ref RP-A2\s*6 penetrations, 3 solutions$/);
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();

  await gotoApp(page, "/sites/site-d");
  await expect(page.getByText("Nothing planned for this site")).toBeVisible();
  await expect(page.getByText("No shortages.")).toBeVisible();
  await expect(page.getByText("Job ref OM-01", { exact: true })).toBeVisible();
});

test("the tab bar sticks directly below the nav header while scrolling", async ({ page }) => {
  // A short screen, so the page always has room to scroll whatever the content height.
  await page.setViewportSize({ width: 375, height: 500 });
  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("heading", { name: "Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  // In dev the stylesheet can land after hydration, so retry until the full-height layout can scroll.
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY > 0;
      }),
    )
    .toBe(true);
  const nav = page.getByRole("navigation", { name: "Site sections" });
  await expect(nav).toBeInViewport();
  await expect(nav.getByRole("link", { name: "Data problems 0" })).toBeInViewport();
  const header = await page.getByRole("banner").boundingBox();
  const bar = await nav.boundingBox();
  if (!header || !bar) throw new Error("header or tab bar has no box");
  expect(Math.abs(bar.y - (header.y + header.height))).toBeLessThan(2);
});

test("the planned-work line pushes in the full penetration list, with only per-penetration facts", async ({ page }) => {
  await gotoApp(page, "/sites/site-c");
  await page.getByRole("link", { name: /5 penetrations, 5 solutions/ }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\/penetrations$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "Penetrations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Kingsway Works, Phase 2" })).toBeVisible();
  await expect(page.getByText("Blocked: hold the crew.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Solution 9999 · 1" })).toBeVisible();
  const missing = page.locator("a[href$='/penetrations/pen-c-03']");
  await expect(missing).toContainText("Solution code 9999 isn't in the catalogue");
  // AC 35: 0943's substrate is cut off in the catalogue, so pen-c-01 cannot be shown to fit.
  await expect(page.locator("a[href$='/penetrations/pen-c-01']")).toContainText("Solution 0943 doesn't fit this penetration: substrate");
  const plant = page.locator("a[href$='/penetrations/pen-c-05']");
  await expect(plant).toContainText("Stock unknown: Fire mastic tube");
  await expect(page.getByText(/\bready\b/i)).toHaveCount(0);
  await assertTargets(page);
  await assertNoOverflow(page);

  await plant.click();
  await expect(page).toHaveURL(/\/sites\/site-c\/penetrations\/pen-c-05$/);

  // A repeated material filter is not one material: full list, with the note.
  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-SEALANT&material=MAT-COLLAR-25");
  await expect(page.getByText("That material is not a shortage on this site. Showing all penetrations.")).toBeVisible();
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);

  await gotoApp(page, "/sites/site-b/penetrations");
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);
  await expect(page.locator("a[href$='/penetrations/pen-b-01']")).toContainText("Uses short material: Intumescent sealant, 310 ml cartridge");
  await expect(page.locator("a[href$='/penetrations/pen-b-01']")).toContainText("Uses short material: Pipe collar for 25 mm pipe");
});
