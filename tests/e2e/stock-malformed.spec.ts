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
