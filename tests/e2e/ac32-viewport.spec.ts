import { expect, test } from "@playwright/test";
import { assertNoOverflow, gotoApp, screens } from "./support";

test("AC 32: a 375px screen does not scroll sideways, including with a dialog open", async ({ page }) => {
  // Read-only. Dialogs are opened and closed. Nothing is sent.
  for (const path of screens) {
    await gotoApp(page, path);
    await assertNoOverflow(page);
  }

  await gotoApp(page, "/materials/MAT-COLLAR-25");
  await page.getByRole("button", { name: "Escalate Pipe collar for 25 mm pipe at Harbour Point, Levels 3 to 5" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Team leader" })).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/materials/MAT-MASTIC");
  await page.getByRole("button", { name: "Wait Fire mastic tube at Kingsway Works, Phase 2" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  await page.getByRole("region", { name: "Substitutes" }).getByRole("button", { name: /Propose this/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-COLLAR-25");
  await assertNoOverflow(page);
});
