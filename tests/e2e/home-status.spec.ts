import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("home shows crew can go for Riverside and nothing planned for Old Mill", async ({ page }) => {
  // Read-only. Does not record an action.
  await gotoApp(page, "/");
  const riverside = page.getByRole("listitem").filter({ hasText: "Riverside Plaza, Block A" });
  await expect(riverside.getByText("Crew can go")).toBeVisible();
  const mill = page.getByRole("listitem").filter({ hasText: "Old Mill Annex" });
  await expect(mill.getByText("Nothing planned")).toBeVisible();
});
