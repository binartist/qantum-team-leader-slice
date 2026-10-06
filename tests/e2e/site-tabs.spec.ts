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
  await expectTabs(page, "Shortages", ["1", "2", "0"]);
  await expect(page.getByRole("heading", { name: "Fire mastic tube" })).toBeVisible();
  await expect(page.getByText("Solution code 9999 isn't in the catalogue")).toHaveCount(0);
  await assertTargets(page);
  await assertNoOverflow(page);

  await page.getByRole("navigation", { name: "Site sections" }).getByRole("link", { name: /^Data problems/ }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\/data-problems$/);
  await expect(page.getByText(banner)).toBeVisible();
  await expectTabs(page, "Data problems", ["1", "2", "0"]);
  await expect(page.getByText("Solution code 9999 isn't in the catalogue")).toBeVisible();
  await expect(page.getByText("No materials recorded for solution 0393")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fire mastic tube" })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Site sections" }).getByRole("link", { name: /^Actions log/ }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\/actions$/);
  await expect(page.getByText(banner)).toBeVisible();
  await expectTabs(page, "Actions log", ["1", "2", "0"]);
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
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();

  await gotoApp(page, "/sites/site-d");
  await expect(page.getByText("Nothing planned for this site")).toBeVisible();
  await expect(page.getByText("No shortages.")).toBeVisible();
});

test("the tab bar sticks directly below the nav header while scrolling", async ({ page }) => {
  await gotoApp(page, "/sites/site-b");
  await page.getByText("Penetrations and substitutes (12)").click();
  const moved = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY > 0;
  });
  expect(moved).toBe(true);
  const nav = page.getByRole("navigation", { name: "Site sections" });
  await expect(nav).toBeInViewport();
  await expect(nav.getByRole("link", { name: "Data problems 0" })).toBeInViewport();
  const header = await page.getByRole("banner").boundingBox();
  const bar = await nav.boundingBox();
  if (!header || !bar) throw new Error("header or tab bar has no box");
  expect(Math.abs(bar.y - (header.y + header.height))).toBeLessThan(2);
});
