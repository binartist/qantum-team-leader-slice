import { expect, test, type Page } from "@playwright/test";
import { assertAxe, gotoApp, screens } from "./support";

test("axe reports no serious or critical violations in light and dark", async ({ page }) => {
  // Read-only. Dialogs and the disclosure are opened and not submitted.
  // error.tsx and global-error.tsx have no safe route: rendering them needs a thrown error, and this suite does not add one.
  test.setTimeout(600_000);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of screens) {
      await gotoApp(page, path);
      await assertAxe(page);
    }
    await openEscalate(page);
    await assertAxe(page);
    await page.keyboard.press("Escape");
    await openWait(page);
    await assertAxe(page);
    await page.keyboard.press("Escape");
    await openPropose(page);
    await assertAxe(page);
    await page.keyboard.press("Escape");
    await openDisclosure(page);
    await assertAxe(page);
  }
});

async function openEscalate(page: Page): Promise<void> {
  await gotoApp(page, "/sites/site-b");
  await page.getByRole("button", { name: /Escalate/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function openWait(page: Page): Promise<void> {
  await gotoApp(page, "/sites/site-c");
  const mastic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fire mastic tube" }) });
  await mastic.getByRole("button", { name: /Wait/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function openPropose(page: Page): Promise<void> {
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "0451" }) }).getByRole("button", { name: /Propose this/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function openDisclosure(page: Page): Promise<void> {
  // The shortage card's penetrations now open as a filtered list page.
  await gotoApp(page, "/sites/site-b");
  const collar = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Pipe collar for 25 mm pipe" }) });
  await collar.getByRole("link", { name: "Affects 4 penetrations" }).click();
  await expect(page).toHaveURL(/\/penetrations\?material=MAT-COLLAR-25$/);
}
