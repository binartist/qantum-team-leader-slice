import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("the sites list shows crew can go for Riverside and nothing planned for Old Mill", async ({ page }) => {
  // Read-only. Does not record an action.
  await gotoApp(page, "/sites");
  const riverside = page.getByRole("listitem").filter({ hasText: "Riverside Plaza, Block A" });
  await expect(riverside.getByText("Crew can go")).toBeVisible();
  const harbour = page.getByRole("listitem").filter({ hasText: "Harbour Point, Levels 3 to 5" });
  await expect(harbour.getByText("Blocked · 2 shortages")).toBeVisible();
  const kingsway = page.getByRole("listitem").filter({ hasText: "Kingsway Works, Phase 2" });
  await expect(kingsway.getByText("Blocked · 1 shortage, 4 data problems")).toBeVisible();
  const mill = page.getByRole("listitem").filter({ hasText: "Old Mill Annex" });
  await expect(mill.getByText("Nothing planned")).toBeVisible();
});

test("landing page explains the demo, no screen carries a Demo tag, and there is no demo footer", async ({ page }) => {
  // Read-only. Follows links only. Does not record an action.
  await gotoApp(page, "/");
  await expect(page).toHaveURL(/\/about-this-demo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ready to send the crew?" })).toBeVisible();
  await expect(page.getByText("Sample sites and stock.", { exact: false })).toBeVisible();
  await expect(page.getByText("No login.", { exact: false })).toBeVisible();
  await expect(page.getByText("shares the same decisions", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Demo/ })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open sites" })).toHaveCount(0);
  // The text links to the pages it names, matching the menu and the walkthrough.
  const main = page.getByRole("main");
  for (const [name, href] of [
    ["Sites", "/sites"],
    ["Harbour Point", "/sites/site-b"],
    ["L3, Riser 2", "/sites/site-b/penetrations/pen-b-01"],
    ["Kingsway Works", "/sites/site-c?show=data-problems"],
  ] as const) {
    await expect(main.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(main.getByRole("link", { name: "Materials", exact: true })).toHaveCount(2);
  await expect(main.getByRole("link", { name: "Actions log", exact: true }).first()).toHaveAttribute("href", "/actions");
  await expect(page.getByRole("banner").getByRole("link", { name: /^Back to / })).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Team leader" }).getByRole("link", { name: "Sites" }).click();
  await expect(page).toHaveURL(/\/sites$/);

  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
  await expect(page.getByText(/\bref RP-A2\b/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to sites" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to site" })).toHaveCount(0);

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(page.getByText(/Stock figures from 3 Oct 2026, 08:00 UTC \(\d+ days? old\)/)).toBeVisible();
  await expect(page.getByText("These stock figures are more than a day old. Check with the warehouse before relying on them.")).toBeVisible();
  await expect(page.locator("main p").filter({ hasText: "Job ref HP-345" })).toHaveText(/^Job ref HP-345\s*12 penetrations, 5 solutions$/);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Demo/ })).toHaveCount(0);

  const back = page.getByRole("link", { name: "Back to sites" });
  const box = await back.boundingBox();
  if (!box) throw new Error("back control has no box");
  await expect(back).toContainText("Sites");
  const headerBox = await page.getByRole("banner").boundingBox();
  if (!headerBox) throw new Error("header has no box");
  // The header is one compact row; the back control sits inside it. The title is the h1 in main, in full, below the header.
  expect(box.y).toBeGreaterThanOrEqual(headerBox.y);
  expect(box.y + box.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);
  expect(headerBox.height).toBeLessThan(64);
  const title = page.getByRole("main").getByRole("heading", { level: 1, name: "Harbour Point, Levels 3 to 5" });
  await expect(title).toBeVisible();
  const titleBox = await title.boundingBox();
  if (!titleBox) throw new Error("title has no box");
  expect(titleBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
  await expect(page.getByRole("banner").getByRole("heading")).toHaveCount(0);
  await back.click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("link", { name: "Shortages 12" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 500 });
  // In dev the stylesheet can land after hydration, so retry until the full-height layout can scroll.
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY > 0;
      }),
    )
    .toBe(true);
  // The sticky header keeps the back control in view at the end of a long page.
  await expect(page.getByRole("banner")).toBeInViewport();
  await expect(page.getByRole("link", { name: "Back to sites" })).toBeInViewport();

  await gotoApp(page, "/sites/site-d");
  await expect(page.getByText("Nothing planned for this site")).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toHaveCount(0);
  await expect(page.getByText(/^As of /)).toHaveCount(0);
  await expect(page.getByText("Stock figures from")).toHaveCount(0);
  await expect(page.getByText("more than a day old")).toHaveCount(0);
});
