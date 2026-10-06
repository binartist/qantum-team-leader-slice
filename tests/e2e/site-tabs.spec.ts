import { expect, test } from "@playwright/test";
import { assertNoOverflow, assertTargets, gotoApp } from "./support";

// Read-only. Runs before the write project, so no actions are recorded yet.

test("AC 34: a blocked site has no summary banner; the chips filter the rows", async ({ page }) => {
  await gotoApp(page, "/sites/site-c");
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await expect(page.locator("main p").filter({ hasText: "Job ref KW-P2" })).toHaveText(/^Job ref KW-P2\s*5 penetrations, 5 solutions$/);
  await expect(page.getByRole("heading", { level: 2, name: "Penetrations 5" })).toBeVisible();
  await expect(page.getByRole("link", { name: /5 penetrations, 5 solutions/ })).toHaveCount(0);
  const filters = page.getByRole("navigation", { name: "Filter penetrations" });
  await expect(filters.getByRole("link", { name: "Shortages 1" })).toBeVisible();
  await expect(filters.getByRole("link", { name: "Data problems 4" })).toBeVisible();
  await expect(filters.getByRole("link", { name: "Acted 0" })).toBeVisible();
  // One row at 375px: a two-row sticky dock would cover focused rows beneath it.
  const tops = await filters.getByRole("link").evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  // Row chips name the kind of problem; the full reason is on the penetration page.
  await expect(page.locator("a[href$='/penetrations/pen-c-05']")).toContainText("Stock unknown");
  await expect(page.locator("a[href$='/penetrations/pen-c-03']")).toContainText("Unknown solution");
  await expect(page.locator("a[href$='/penetrations/pen-c-04']")).toContainText("No materials");
  await expect(page.getByRole("button", { name: "Actions log 0" })).toBeVisible();
  await assertTargets(page);
  await assertNoOverflow(page);

  await filters.getByRole("link", { name: "Data problems 4" }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\?show=data-problems$/);
  await expect(filters.getByRole("link", { name: "Data problems 4" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("a[href$='/penetrations/pen-c-03']")).toContainText("Unknown solution");
  await expect(page.locator("a[href$='/penetrations/pen-c-05']")).toHaveCount(0);

  await filters.getByRole("link", { name: "Shortages 1" }).click();
  await expect(page).toHaveURL(/show=data-problems/);
  await expect(page).toHaveURL(/show=shortages/);
  await expect(page.locator("a[href$='/penetrations/pen-c-05']")).toContainText("Stock unknown");
  await expect(page.locator("a[href$='/penetrations/pen-c-03']")).toContainText("Unknown solution");
  await assertTargets(page);
  await assertNoOverflow(page);

  await page.getByRole("button", { name: /^Actions log/ }).click();
  const log = page.getByRole("dialog", { name: "Actions log" });
  await expect(log.getByText("Nothing recorded for this site yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sites" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(log).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Actions log/ })).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 800 });
  await assertNoOverflow(page);
  await page.getByRole("button", { name: /^Actions log/ }).click();
  await expect(page.getByRole("dialog", { name: "Actions log" })).toBeVisible();
  await assertNoOverflow(page);
});

test("a clear site still reads Crew can go, and an empty filter says so", async ({ page }) => {
  await gotoApp(page, "/sites/site-a/data-problems");
  await expect(page).toHaveURL(/\/sites\/site-a\?show=data-problems$/);
  await expect(page.getByText("Crew can go")).toBeVisible();
  await expect(page.getByRole("link", { name: "Data problems 0" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("No penetrations match these filters.")).toBeVisible();

  await gotoApp(page, "/sites/site-a");
  await expect(page.locator("main a[href*='/penetrations/pen-a-']")).toHaveCount(6);
  await expect(page.locator("main p").filter({ hasText: "Job ref RP-A2" })).toHaveText(/^Job ref RP-A2\s*6 penetrations, 3 solutions$/);
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();

  await gotoApp(page, "/sites/site-d");
  await expect(page.getByText("Nothing planned for this site")).toBeVisible();
  await expect(page.getByText("No penetrations planned for this site.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Penetrations 0" })).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toHaveCount(0);
  await expect(page.getByText("Job ref OM-01", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shortages 0" })).toBeVisible();
});

test("the actions log stays in the header while the list scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("link", { name: "Shortages 12" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY > 0;
      }),
    )
    .toBe(true);
  const header = page.getByRole("banner");
  await expect(header.getByRole("button", { name: /^Actions log/ })).toBeInViewport();
});

test("the site page is the penetration list, and old list URLs redirect onto it", async ({ page }) => {
  await gotoApp(page, "/sites/site-c");
  await expect(page.locator("main a[href*='/penetrations/pen-c-']")).toHaveCount(5);
  await expect(page.locator("a[href$='/penetrations/pen-c-03']")).toContainText("Unknown solution");
  // AC 35: 0943's substrate is cut off in the catalogue, so pen-c-01 cannot be shown to fit.
  await expect(page.locator("a[href$='/penetrations/pen-c-01']")).toContainText("Doesn't fit");
  const plant = page.locator("a[href$='/penetrations/pen-c-05']");
  await expect(plant).toContainText("Stock unknown");
  await expect(page.getByText(/\bready\b/i)).toHaveCount(0);
  await assertTargets(page);
  await assertNoOverflow(page);

  await gotoApp(page, "/sites/site-c/penetrations");
  await expect(page).toHaveURL(/\/sites\/site-c$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "Kingsway Works, Phase 2" })).toBeVisible();

  await gotoApp(page, "/sites/site-c/actions");
  await expect(page).toHaveURL(/\/sites\/site-c\?log=open$/);
  await expect(page.getByRole("dialog", { name: "Actions log" })).toBeVisible();

  // A repeated material filter is not one material: full list, with the note.
  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-SEALANT&material=MAT-COLLAR-25");
  await expect(page).toHaveURL(/material=MAT-SEALANT/);
  await expect(page).toHaveURL(/material=MAT-COLLAR-25/);
  await expect(page.getByText("That material is not a shortage on this site. Showing all penetrations.")).toBeVisible();
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);

  await gotoApp(page, "/sites/site-b/penetrations");
  await expect(page).toHaveURL(/\/sites\/site-b$/);
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);
  // pen-b-01 uses both short materials: one chip with a count, and no material links on the row.
  const riser = page.locator("li").filter({ has: page.locator("a[href$='/penetrations/pen-b-01']") });
  await expect(riser).toContainText("Short material × 2");
  await expect(riser.locator("a[href*='/materials/']")).toHaveCount(0);
});
