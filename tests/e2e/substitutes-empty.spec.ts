import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("empty substitutes name the reason, and only a related decision offers escalate", async ({ page }) => {
  // Read-only. The escalate control on pen-b-10 is not used.
  await gotoApp(page, "/sites/site-a/penetrations/pen-a-01");
  await expect(page.getByText("No catalogue match for this penetration.", { exact: true })).toBeVisible();
  await expect(page.getByText("Catalogue match, not verified")).toHaveCount(0);
  await expect(page.getByText("Escalate instead")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Escalate/ })).toHaveCount(0);

  await gotoApp(page, "/sites/site-b/penetrations/pen-b-10");
  await expect(page.getByText("No catalogue match for this penetration. Escalate instead.")).toBeVisible();
  await expect(page.getByText("Catalogue match, not verified")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Escalate/ })).toBeVisible();

  await gotoApp(page, "/sites/site-c/penetrations/pen-c-01");
  await expect(page.getByText("The catalogue entry for this substrate is incomplete, so we can't suggest substitutes.")).toBeVisible();
  await expect(page.getByText("Catalogue match, not verified")).toHaveCount(0);
  // AC 35: pen-c-01 is now a data problem, so it has a related decision to escalate.
  await expect(page.getByRole("button", { name: /Escalate/ })).toBeVisible();
});
