import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("stock down shows can't check and never crew can go", async ({ page }) => {
  // Runs on the stock-down server (STUB_STOCK_MODE=down), not the main server.
  await gotoApp(page, "/sites");
  await expect(page.getByText("Can't check")).toHaveCount(4);
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByText("Can't check this site right now. Don't assume it's clear. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sites" })).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  // Tabs still work, with no counts where readiness is unknown. The log needs stock too, so it shows one panel, not two.
  const nav = page.getByRole("navigation", { name: "Site sections" });
  await expect(nav.getByRole("link", { name: "Shortages", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Data problems", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: /^Actions log/ }).click();
  await expect(page).toHaveURL(/\/sites\/site-b\/actions$/);
  await expect(page.getByText("Can't check this site right now. Don't assume it's clear. Try again.")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Actions log", exact: true })).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
