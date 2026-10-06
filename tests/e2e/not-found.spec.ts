import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("unknown site and penetration render the not-found page with a link back", async ({ page }) => {
  // Read-only.
  for (const path of ["/sites/nope", "/sites/site-b/penetrations/nope"]) {
    await gotoApp(page, path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("That page does not exist.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to sites" })).toHaveAttribute("href", "/sites");
  }
  await page.getByRole("link", { name: "Back to sites" }).click();
  await expect(page.getByRole("heading", { name: "Sites" })).toBeVisible();
});
