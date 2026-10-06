import { expect, test, type Page } from "@playwright/test";
import { assertAxe, assertNoOverflow, assertTargets, gotoApp } from "./support";

// Read-only. The 375px drawer specs stay in navigation-drawer.spec.ts. These run wide.

async function expectClean(page: Page): Promise<void> {
  await assertAxe(page);
  await assertTargets(page);
  await assertNoOverflow(page);
}

test("AC 47: at 1280px the sites list shows the side menu and no empty header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page, "/sites");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Sites", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);
});

test("AC 47: a penetration keeps its back control and the side menu marks Sites", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Sites", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("banner").getByRole("link", { name: "Back to Harbour Point, Levels 3 to 5" })).toBeVisible();
});

test("AC 47: the side menu marks Materials, Actions log and About from the path", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page, "/materials/MAT-SEALANT");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Materials", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await gotoApp(page, "/actions");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Actions log", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await gotoApp(page, "/about-this-demo");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About this demo", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("AC 47: collapse is remembered across a reload and expand clears it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page, "/sites");
  await page.getByRole("button", { name: "Collapse menu" }).click();
  const expand = page.getByRole("button", { name: "Expand menu" });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(expand).toHaveAttribute("aria-controls", /.+/);
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");

  const sites = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sites", exact: true });
  const box = await sites.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.locator("aside").getByRole("group", { name: "Theme" })).toHaveCount(0);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
  await page.getByRole("button", { name: "Expand menu" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar");
});

test("AC 47: the actions log site heading sticks at the top when the wide header is hidden", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page, "/actions");
  // Nothing is recorded yet, so the log is too short to scroll. Give the page room below (style only, no data),
  // then scroll just past Harbour Point's heading: stuck, it sits at 0; under a leftover header offset or not stuck, it does not.
  const top = await page.evaluate(() => {
    document.querySelector("main")?.style.setProperty("padding-bottom", "100vh");
    const heading = document.querySelector("#site-site-b h2");
    if (!(heading instanceof HTMLElement)) return Number.NaN;
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY + 8);
    return heading.getBoundingClientRect().top;
  });
  expect(Math.abs(top)).toBeLessThanOrEqual(2);
});

test("AC 47: wide pages pass axe, targets and overflow expanded and collapsed", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ["/sites", "/sites/site-b"]) {
    await gotoApp(page, path);
    await expectClean(page);
    await page.getByRole("button", { name: "Collapse menu" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
    await expectClean(page);
    await page.getByRole("button", { name: "Expand menu" }).click();
  }

  await page.setViewportSize({ width: 1024, height: 800 });
  await gotoApp(page, "/sites/site-b");
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar");
  await expectClean(page);
});
