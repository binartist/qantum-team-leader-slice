import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("home shows crew can go for Riverside and nothing planned for Old Mill", async ({ page }) => {
  // Read-only. Does not record an action.
  await gotoApp(page, "/");
  const riverside = page.getByRole("listitem").filter({ hasText: "Riverside Plaza, Block A" });
  await expect(riverside.getByText("Crew can go")).toBeVisible();
  const harbour = page.getByRole("listitem").filter({ hasText: "Harbour Point, Levels 3 to 5" });
  await expect(harbour.getByText("Blocked · 2 shortages")).toBeVisible();
  const kingsway = page.getByRole("listitem").filter({ hasText: "Kingsway Works, Phase 2" });
  await expect(kingsway.getByText("Blocked · 1 shortage, 2 data problems")).toBeVisible();
  const mill = page.getByRole("listitem").filter({ hasText: "Old Mill Annex" });
  await expect(mill.getByText("Nothing planned")).toBeVisible();
});

test("navigation shell, bottom demo bar, and labelled reference", async ({ page }) => {
  // Read-only. Opens a site and follows the back control. Does not record an action.
  await gotoApp(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
  await expect(page.getByText("Ref RP-A2", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sites" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to site" })).toHaveCount(0);

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(page.getByText(/Stock figures from 3 Oct 2026, 08:00 UTC \(\d+ days? old\)/)).toBeVisible();
  await expect(page.getByText("These stock figures are more than a day old. Check with the warehouse before relying on them.")).toBeVisible();
  await expect(page.getByText("Ref HP-345", { exact: true })).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Demo: sample data, no login");

  const back = page.getByRole("link", { name: "Back to sites" });
  const box = await back.boundingBox();
  if (!box) throw new Error("back control has no box");
  await expect(back).toContainText("Sites");
  const headerBox = await page.getByRole("banner").boundingBox();
  if (!headerBox) throw new Error("header has no box");
  expect(box.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("heading", { level: 2, name: "Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  const demo = page.getByRole("contentinfo").getByText("Demo: sample data, no login");
  await expect(demo).toBeVisible();
  const before = await demo.boundingBox();
  const moved = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY > 0;
  });
  expect(moved).toBe(true);
  const header = page.getByRole("banner");
  await expect(header).toBeInViewport();
  // At the end of the page the bar sits below the last content and covers none of it.
  const clear = await page.evaluate(() => {
    const main = document.querySelector("main");
    const bar = document.querySelector("footer");
    if (!main || !bar) return false;
    return bar.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 1;
  });
  expect(clear).toBe(true);
  await expect(demo).toBeInViewport();
  const after = await demo.boundingBox();
  if (!before || !after) throw new Error("demo bar has no box");
  expect(Math.abs(before.y - after.y)).toBeLessThan(2);

  await gotoApp(page, "/sites/site-d");
  await expect(page.getByText("Nothing planned for this site")).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toHaveCount(0);
  await expect(page.getByText(/^As of /)).toHaveCount(0);
  await expect(page.getByText("Stock figures from")).toHaveCount(0);
  await expect(page.getByText("more than a day old")).toHaveCount(0);
});
