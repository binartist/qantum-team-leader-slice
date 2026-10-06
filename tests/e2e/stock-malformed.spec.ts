import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("malformed stock shows can't check and never crew can go", async ({ page }) => {
  // Runs on the malformed-stock server (STUB_STOCK_MODE=malformed), not the main server.
  await gotoApp(page, "/sites");
  await expect(page.getByText("Can't check")).toHaveCount(4);
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("main").getByText("Can't check this site right now. Don't assume it's clear. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sites" })).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});

test("AC 38, AC 39: with the stock malformed, the materials pages say they can't check, never zero or not short", async ({ page }) => {
  await gotoApp(page, "/materials");
  await expect(page.getByText("Can't check stock right now. Don't assume any material is in stock. Try again.")).toBeVisible();
  await expect(page.locator("main a[href^='/materials/']")).toHaveCount(0);
  await expect(page.getByText(/On hand \d|Not short/)).toHaveCount(0);

  await gotoApp(page, "/materials/MAT-SEALANT");
  await expect(page.getByRole("heading", { level: 1, name: "Material" })).toBeVisible();
  await expect(page.getByText("Can't check stock right now. Don't assume any material is in stock. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Wait|Escalate/ })).toHaveCount(0);
  await expect(page.getByText(/Needs \d/)).toHaveCount(0);
});
