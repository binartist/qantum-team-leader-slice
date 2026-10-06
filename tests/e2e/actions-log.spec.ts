import { expect, test } from "@playwright/test";
import { assertAxe, assertNoOverflow, assertTargets, gotoApp } from "./support";

// Read-only. Runs before the write project, so no actions are recorded yet.

const SITES = [
  ["site-a", "Riverside Plaza, Block A"],
  ["site-b", "Harbour Point, Levels 3 to 5"],
  ["site-c", "Kingsway Works, Phase 2"],
  ["site-d", "Old Mill Annex"],
] as const;

test("AC 43: the menu opens the actions log, one section per site", async ({ page }) => {
  await gotoApp(page, "/sites");
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Team leader" });
  const item = drawer.getByRole("link", { name: "Actions log" });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/actions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Actions log" })).toBeVisible();

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Team leader" }).getByRole("link", { name: "Actions log" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");

  for (const [id, name] of SITES) {
    const section = page.locator(`#site-${id}`);
    await expect(section.getByRole("heading", { level: 2, name })).toBeVisible();
    const heading = section.getByRole("heading", { level: 2, name });
    // The site's kind icon leads its heading, and the heading sticks while the section scrolls.
    await expect(heading.locator("svg").first()).toBeVisible();
    await expect(heading).toHaveCSS("position", "sticky");
    await expect(section.getByRole("link", { name })).toHaveAttribute("href", `/sites/${id}?fromLog=${id}`);
  }

  // A site opened from the log goes back to the log, by popping it, not to the sites list.
  await page.locator("#site-site-b").getByRole("link", { name: "Harbour Point, Levels 3 to 5" }).click();
  await expect(page).toHaveURL(/\/sites\/site-b\?fromLog=site-b$/);
  // Filter chips keep the way back.
  await page.getByRole("link", { name: /^Acted/ }).click();
  await expect(page).toHaveURL(/show=acted&fromLog=site-b$/);
  await page.getByRole("link", { name: "Back to Actions log" }).click();
  await expect(page).toHaveURL(/\/actions(#site-site-b)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Actions log" })).toBeVisible();

  // A foreign or missing origin leaves back on the parent.
  await gotoApp(page, "/sites/site-b?fromLog=site-c");
  await expect(page.getByRole("link", { name: "Back to Sites" })).toBeVisible();
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01?fromLog=site-b");
  await expect(page.getByRole("link", { name: "Back to Actions log" })).toHaveAttribute("href", "/actions#site-site-b");
  await gotoApp(page, "/materials/MAT-COLLAR-25?fromLog=site-c");
  await expect(page.getByRole("link", { name: "Back to Materials" })).toBeVisible();
  await gotoApp(page, "/materials/MAT-COLLAR-25?fromLog=site-b#site-site-b");
  await expect(page.getByRole("link", { name: "Back to Actions log" })).toHaveAttribute("href", "/actions#site-site-b");
  await gotoApp(page, "/actions");

  await gotoApp(page, "/sites/site-b/actions");
  await expect(page).toHaveURL(/\/actions#site-site-b$/);
  await expect(page.locator("#site-site-b")).toBeInViewport();

  await assertAxe(page);
  await assertTargets(page);
  await assertNoOverflow(page);
});
