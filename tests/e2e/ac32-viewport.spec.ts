import { expect, test } from "@playwright/test";
import { assertNoOverflow, gotoApp, screens } from "./support";

test("AC 32: a 375px screen does not scroll sideways, including with a dialog open", async ({ page }) => {
  // Read-only. Dialogs are opened and closed. Nothing is sent.
  for (const path of screens) {
    await gotoApp(page, path);
    await assertNoOverflow(page);
  }

  await gotoApp(page, "/sites/site-b");
  await page.getByRole("button", { name: /Escalate/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-c");
  const mastic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fire mastic tube" }) });
  await mastic.getByRole("button", { name: /Wait/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "0451" }) }).getByRole("button", { name: /Propose this/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoOverflow(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b");
  const collar = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Pipe collar for 25 mm pipe" }) });
  await collar.getByText("Penetrations and substitutes (4)").click();
  await assertNoOverflow(page);
});
