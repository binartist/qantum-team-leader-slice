import { expect, test } from "@playwright/test";
import { assertTargets, gotoApp, screens, tabTo } from "./support";

test("AC 31: escalate with the keyboard only, and targets are at least 44 by 44", async ({ page }) => {
  // Writes the collar shortage (site-b:MAT-COLLAR-25) only. Sealant stays for the scenario spec.
  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("button", { name: /Escalate/ }).first()).toBeVisible();
  await tabTo(page, /Escalate Pipe collar for 25 mm pipe/);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("This does not release the crew.")).toBeVisible();
  await expect(dialog.getByLabel("Send to")).toHaveValue("purchasing");
  await assertTargets(page);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
    if (tag === "TEXTAREA") break;
    await page.keyboard.press("Tab");
  }
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("TEXTAREA");
  await page.keyboard.type("Noted from the keyboard");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => (document.activeElement?.textContent ?? "").includes("Send escalation"))).toBe(true);
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-announcer]")).toHaveText("Escalation recorded");
  const collar = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Pipe collar for 25 mm pipe" }) });
  await expect(collar.getByText("Escalated")).toBeVisible();
  await expect(page.getByText(/Blocked:/)).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  for (const path of screens) {
    await gotoApp(page, path);
    await assertTargets(page);
  }

  // Opens the Wait dialog for measurement and does not send.
  await gotoApp(page, "/sites/site-c");
  const mastic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fire mastic tube" }) });
  await mastic.getByRole("button", { name: /Wait/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertTargets(page);
  await page.keyboard.press("Escape");

  // Opens the Propose dialog for measurement and does not send.
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "0451" }) }).getByRole("button", { name: /Propose this/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertTargets(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-COLLAR-25");
  await assertTargets(page);
});
