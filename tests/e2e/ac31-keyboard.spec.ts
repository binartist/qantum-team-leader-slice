import { expect, test } from "@playwright/test";
import { assertTargets, gotoApp, screens, tabTo } from "./support";

test("AC 31: escalate with the keyboard only, and targets are at least 44 by 44", async ({ page }) => {
  // Writes the collar shortage (site-b:MAT-COLLAR-25) only. Sealant stays for the scenario spec.
  await gotoApp(page, "/materials/MAT-COLLAR-25");
  await expect(page.getByRole("button", { name: "Escalate Pipe collar for 25 mm pipe at Harbour Point, Levels 3 to 5" })).toBeVisible();
  await tabTo(page, /Escalate Pipe collar for 25 mm pipe at Harbour Point/);
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
  await page.getByRole("navigation", { name: "Material" }).getByRole("link", { name: /Actions log/ }).click();
  await expect(page).toHaveURL(/\/materials\/MAT-COLLAR-25\?tab=log$/);
  await expect(page.getByText("Escalated to purchasing: Pipe collar for 25 mm pipe")).toBeVisible();
  await expect(page.getByText("At Harbour Point, Levels 3 to 5")).toBeVisible();
  await expect(page.getByText("Noted from the keyboard")).toBeVisible();
  await page.getByRole("navigation", { name: "Material" }).getByRole("link", { name: "Stock" }).click();
  await expect(page.locator("#site-site-b").getByText("Escalated", { exact: true })).toHaveCount(0);
  await gotoApp(page, "/sites/site-b");
  await expect(page.getByRole("link", { name: "Acted 4" })).toBeVisible();
  await page.getByRole("link", { name: "Acted 4" }).click();
  await expect(page).toHaveURL(/show=acted/);
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(4);
  // The decision is an icon inside the row link (AC 44). The hidden label is the full wording; the count is visible.
  const row = page.locator("a[href$='/penetrations/pen-b-01']");
  const escalated = row.locator("[title='Escalated']");
  await expect(escalated).toContainText("Escalated");
  await expect(escalated.locator("span[aria-hidden='true']")).toHaveText("1");
  await expect(escalated.locator("span[aria-hidden='true']")).toBeVisible();
  await expect(row.locator("svg").first()).toBeVisible();
  await expect(row.locator("button")).toHaveCount(0);
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await expect(page.getByText("Crew can go")).toHaveCount(0);
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01?tab=log");
  const tabs = page.getByRole("navigation", { name: "Penetration" });
  const logTab = tabs.getByRole("link", { name: /Actions log/ });
  await expect(logTab).toHaveAttribute("aria-current", "page");
  await expect(logTab).toContainText(/\d+/);
  await expect(page.getByText("Escalated to purchasing: Pipe collar for 25 mm pipe")).toBeVisible();
  await expect(page.getByText("Noted from the keyboard")).toBeVisible();
  await expect(page.getByText("Applies to all 4 penetrations at this site")).toBeVisible();
  await page.getByRole("link", { name: "Escalated to purchasing: Pipe collar for 25 mm pipe" }).click();
  await expect(page).toHaveURL(/\/materials\/MAT-COLLAR-25\?from=pen-b-01#site-site-b$/);
  await page.getByRole("link", { name: "Back to L3, Riser 2" }).click();
  await expect(page).toHaveURL(/\/sites\/site-b\/penetrations\/pen-b-01\?tab=log$/);
  await assertTargets(page);
  await gotoApp(page, "/sites");
  await expect(page.getByRole("listitem").filter({ hasText: "Harbour Point, Levels 3 to 5" }).getByText("Blocked · 2 shortages")).toBeVisible();

  // AC 43: the logged decision opens the material page at its site, and back returns to the log.
  await gotoApp(page, "/actions");
  await page.locator("#site-site-b").getByRole("link", { name: "Escalated to purchasing: Pipe collar for 25 mm pipe" }).click();
  await expect(page).toHaveURL(/\/materials\/MAT-COLLAR-25\?fromLog=site-b#site-site-b$/);
  await page.getByRole("link", { name: "Back to Actions log" }).click();
  await expect(page).toHaveURL(/\/actions(#site-site-b)?$/);

  for (const path of screens) {
    await gotoApp(page, path);
    await assertTargets(page);
  }

  // Opens the Wait dialog for measurement and does not send.
  await gotoApp(page, "/materials/MAT-MASTIC");
  await page.getByRole("button", { name: "Wait Fire mastic tube at Kingsway Works, Phase 2" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertTargets(page);
  await page.keyboard.press("Escape");

  // Opens the Propose dialog for measurement and does not send.
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  await page.getByRole("region", { name: "Substitutes" }).getByRole("button", { name: /Propose this/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertTargets(page);
  await page.keyboard.press("Escape");

  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-COLLAR-25");
  await assertTargets(page);
});
