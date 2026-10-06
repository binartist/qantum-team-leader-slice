import { expect, test } from "@playwright/test";
import { assertNoOverflow, gotoApp, screens } from "./support";

test("AC 32: a 375px screen does not scroll sideways, including with a dialog open", async ({ page }) => {
  // Read-only. Dialogs are opened and closed. Nothing is sent.
  for (const path of screens) {
    await gotoApp(page, path);
    await assertNoOverflow(page);
  }

  await gotoApp(page, "/sites/site-b/materials/MAT-COLLAR-25");
  await page.getByRole("button", { name: "Escalate Pipe collar for 25 mm pipe" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b");
  await page.getByRole("button", { name: /^Actions log/ }).click();
  await expect(page.getByRole("dialog", { name: "Actions log" })).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-c/materials/MAT-MASTIC");
  await page.getByRole("button", { name: "Wait Fire mastic tube" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Solution 0451" }) }).getByRole("button", { name: /Propose this/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-COLLAR-25");
  await assertNoOverflow(page);
});
