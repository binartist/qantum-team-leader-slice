import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("stock down shows can't check and never crew can go", async ({ page }) => {
  // Runs on the stock-down server (STUB_STOCK_MODE=down), not the main server.
  await gotoApp(page, "/sites");
  await expect(page.getByText("Can't check")).toHaveCount(4);
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("main").getByText("Can't check this site right now. Don't assume it's clear. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sites" })).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  // No filter counts when readiness is unknown. The log needs stock too, so the panel says it cannot be read.
  await expect(page.getByRole("navigation", { name: "Filter penetrations" })).toHaveCount(0);
  const logButton = page.getByRole("button", { name: "Actions log", exact: true });
  await expect(logButton).toBeVisible();
  await logButton.click();
  const log = page.getByRole("dialog", { name: "Actions log" });
  await expect(log.getByText("Can't check this site right now. Don't assume it's clear. Try again.")).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
