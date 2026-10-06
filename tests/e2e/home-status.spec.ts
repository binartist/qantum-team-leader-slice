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
  await expect(kingsway.getByText("Blocked · 1 shortage, 2 data problems")).toBeVisible();
  const mill = page.getByRole("listitem").filter({ hasText: "Old Mill Annex" });
  await expect(mill.getByText("Nothing planned")).toBeVisible();
});

test("landing page explains the demo, every other screen carries a Demo tag, and there is no demo footer", async ({ page }) => {
  // Read-only. Follows links only. Does not record an action.
  await gotoApp(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: "Ready to send the crew?" })).toBeVisible();
  await expect(page.getByText("Sample sites and stock.", { exact: false })).toBeVisible();
  await expect(page.getByText("No login.", { exact: false })).toBeVisible();
  await expect(page.getByText("shares the same decisions", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Demo/ })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  // Open sites sticks to the bottom: in view at the top of the page, and still in view at the end without covering text.
  const open = page.getByRole("link", { name: "Open sites" });
  await expect(open).toBeInViewport();
  // It fills the screen width inside the 16px side gutters.
  const openBox = await open.boundingBox();
  if (!openBox) throw new Error("open sites has no box");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  expect(openBox.width).toBeGreaterThanOrEqual(viewport.width - 32 - 1);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(open).toBeInViewport();
  await expect(page.getByText("Tap Demo at the top of any screen to come back here.")).toBeInViewport();
  await open.click();
  await expect(page).toHaveURL(/\/sites$/);

  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
  await expect(page.getByText(/\bref RP-A2\b/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to sites" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to site" })).toHaveCount(0);

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(page.getByText(/Stock figures from 3 Oct 2026, 08:00 UTC \(\d+ days? old\)/)).toBeVisible();
  await expect(page.getByText("These stock figures are more than a day old. Check with the warehouse before relying on them.")).toBeVisible();
  await expect(page.getByText("Job ref HP-345", { exact: true })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  const tag = page.getByRole("banner").getByRole("link", { name: "Demo: sample data, no login. About this demo" });
  await expect(tag).toHaveText("Demo");
  const tagBox = await tag.boundingBox();
  if (!tagBox) throw new Error("demo tag has no box");
  expect(tagBox.width).toBeGreaterThanOrEqual(44);
  expect(tagBox.height).toBeGreaterThanOrEqual(44);

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
  await expect(page.getByRole("heading", { level: 2, name: "Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  const moved = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY > 0;
  });
  expect(moved).toBe(true);
  // The sticky header keeps the Demo tag in view at the end of a long page.
  await expect(page.getByRole("banner")).toBeInViewport();
  await expect(page.getByRole("banner").getByRole("link", { name: /^Demo/ })).toBeInViewport();
  await page.getByRole("banner").getByRole("link", { name: /^Demo/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ready to send the crew?" })).toBeVisible();

  await gotoApp(page, "/sites/site-d");
  await expect(page.getByText("Nothing planned for this site")).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toHaveCount(0);
  await expect(page.getByText(/^As of /)).toHaveCount(0);
  await expect(page.getByText("Stock figures from")).toHaveCount(0);
  await expect(page.getByText("more than a day old")).toHaveCount(0);
});
