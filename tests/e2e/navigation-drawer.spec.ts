import { expect, test, type Page } from "@playwright/test";
import { assertAxe, assertNoOverflow, assertTargets, gotoApp, tabTo } from "./support";

// Read-only. Runs before the write project, so no decisions are recorded yet.

function drawerOf(page: Page) {
  return page.getByRole("dialog", { name: "Team leader" });
}

test("AC 37: the landing page leads with the same menu, and About this demo is current", async ({ page }) => {
  await gotoApp(page, "/");
  await expect(page.getByRole("banner").getByRole("link", { name: /^Back to / })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open sites" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = drawerOf(page);
  await expect(drawer.getByRole("link", { name: "About this demo" })).toHaveAttribute("aria-current", "page");
  const nav = drawer.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Sites" })).not.toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Materials" })).not.toHaveAttribute("aria-current", "page");
  await drawer.getByRole("link", { name: "Sites" }).click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(drawer).toBeHidden();
});

test("AC 37: the menu opens a left drawer with Sites and Materials, the current one marked", async ({ page }) => {
  await gotoApp(page, "/sites");
  // The leading control on a top-level list is the menu, never a back control.
  await expect(page.getByRole("banner").getByRole("link", { name: /^Back to / })).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Open menu" });
  await tabTo(page, /Open menu/);
  await page.keyboard.press("Enter");
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  const nav = drawer.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Sites" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Materials" })).not.toHaveAttribute("aria-current", "page");
  await expect(drawer.getByRole("link", { name: "About this demo" })).toHaveAttribute("href", "/about-this-demo");
  // Left side, once the slide-in has settled.
  await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0);
  await assertTargets(page);
  await assertAxe(page);

  // The page behind a modal drawer is inert: tabbing never reaches it. (Past the last control the browser
  // may move focus to its own toolbar, which the page sees as the body.)
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    const outside = await page.evaluate(() => {
      const el = document.activeElement;
      return el !== null && el !== document.body && !el.closest("dialog");
    });
    expect(outside).toBe(false);
  }
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
});

test("AC 37: the close control and the backdrop close the drawer and return focus; a link closes it as it navigates", async ({ page }) => {
  await gotoApp(page, "/sites");
  const menu = page.getByRole("button", { name: "Open menu" });

  await menu.click();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(drawerOf(page)).toBeHidden();
  await expect(menu).toBeFocused();

  // At 375px the drawer is at most 85% wide, so the right edge is backdrop.
  await menu.click();
  await expect.poll(async () => (await drawerOf(page).boundingBox())?.x).toBe(0);
  await page.mouse.click(365, 400);
  await expect(drawerOf(page)).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await drawerOf(page).getByRole("link", { name: "Materials" }).click();
  await expect(page).toHaveURL(/\/materials$/);
  await expect(page.getByRole("heading", { level: 1, name: "Materials" })).toBeVisible();
  await expect(drawerOf(page)).toBeHidden();
  await expect(page.getByRole("banner").getByRole("link", { name: /^Back to / })).toHaveCount(0);

  // Inner screens lead with the back control, never the menu.
  for (const path of ["/sites/site-b", "/sites/site-b/penetrations/pen-b-01", "/materials/MAT-COLLAR-25"]) {
    await gotoApp(page, path);
    await expect(page.getByRole("button", { name: "Open menu" }), path).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: /^Back to / }), path).toBeVisible();
  }
});

test("AC 38: the materials list shows each planned material against the shared stock, across sites", async ({ page }) => {
  await gotoApp(page, "/materials");
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();
  const rows = page.locator("main a[href^='/materials/']");
  await expect(rows).toHaveCount(6);
  // By name; putty is mapped only to a substitute nobody nominates, so no site plans it.
  await expect(rows.first()).toContainText("Fire mastic tube");
  await expect(page.locator("main a[href='/materials/MAT-PUTTY']")).toHaveCount(0);

  const collar = page.locator("main a[href='/materials/MAT-COLLAR-25']");
  await expect(collar).toContainText("On hand 2 · planned across sites 6");
  await expect(collar).toContainText("Short at 1 site");
  const mastic = page.locator("main a[href='/materials/MAT-MASTIC']");
  await expect(mastic).toContainText("Planned across sites 1 tube");
  await expect(mastic).toContainText("Stock unknown · needed at 1 site");
  await expect(mastic).not.toContainText("Not short");
  // Status chips carry an icon, never colour alone.
  await expect(mastic.locator("svg[aria-hidden='true']")).not.toHaveCount(0);
  const wrap = page.locator("main a[href='/materials/MAT-WRAP']");
  await expect(wrap).toContainText("Not short at any site");
  await expect(page.getByText(/\bready\b/i)).toHaveCount(0);
  await assertTargets(page);
  await assertNoOverflow(page);

  await collar.click();
  await expect(page).toHaveURL(/\/materials\/MAT-COLLAR-25$/);
  await expect(page.getByRole("link", { name: "Back to Materials" })).toBeVisible();
});

test("AC 37: the menu's theme choice pins light or dark, is remembered on this device, and System follows the device", async ({ page }) => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: "light" });
  await gotoApp(page, "/sites");
  await page.getByRole("button", { name: "Open menu" }).click();
  const theme = drawerOf(page).getByRole("group", { name: "Theme" });
  await expect(theme.getByRole("radio", { name: "System" })).toBeChecked();

  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(18, 19, 22)");
  await assertAxe(page);
  await assertTargets(page);

  // Remembered: stamped before the page paints, and shown as the choice.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(theme.getByRole("radio", { name: "Dark" })).toBeChecked();

  // Arrow keys move the choice, as in any radio group.
  await theme.getByRole("radio", { name: "Dark" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(theme.getByRole("radio", { name: "Light" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Light overrides a dark device; System hands it back.
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(255, 255, 255)");
  await theme.getByRole("radio", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await background()).toBe("rgb(18, 19, 22)");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});
