import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("AC 30: a material page shows need, have, short, who it is planned on, and its state as text", async ({ page }) => {
  // Read-only. Expects no decision yet. The write project runs after this one.
  await gotoApp(page, "/sites/site-b/materials/MAT-SEALANT");
  await expect(page.getByRole("heading", { level: 1, name: "Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  // User decision: the need and the places are this site's; the stock on hand is shared with other sites.
  await expect(page.getByText("Harbour Point, Levels 3 to 5 needs 10, on hand 8 (shared with other sites), short 2 cartridges")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Planned at Harbour Point, Levels 3 to 5: 12 penetrations" })).toBeVisible();
  // Identical places are one line; none is a link, because the penetration page links here.
  await expect(page.getByText("L3, Riser 2 · PEX Pipe Ø25mm ×4", { exact: true })).toBeVisible();
  await expect(page.getByText("L5, Plant room · Steel Pipe Ø28mm", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /L3, Riser 2/ })).toHaveCount(0);

  await gotoApp(page, "/sites/site-b/materials/MAT-COLLAR-25");
  await expect(page.getByText("Harbour Point, Levels 3 to 5 needs 4, on hand 2 (shared with other sites), short 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Planned at Harbour Point, Levels 3 to 5: 4 penetrations" })).toBeVisible();
  // A wait or escalate covers the whole site's need, not one penetration.
  await expect(page.getByText("For all 4 penetrations at this site", { exact: true })).toBeVisible();
  const collarState = page.getByText("No decision yet", { exact: true });
  await expect(collarState).toBeVisible();
  await expect(collarState.locator("svg")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wait Pipe collar for 25 mm pipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escalate Pipe collar for 25 mm pipe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "L3, Riser 2 · PEX Pipe Ø25mm" })).toHaveCount(0);
  await expect(page.getByText("L3, Riser 2 · PEX Pipe Ø25mm ×4", { exact: true })).toHaveCount(1);
  // The way to act on one of them is up through the site list, filtered to this material.
  await expect(page.getByRole("link", { name: "Show these on the site list" })).toHaveAttribute("href", "/sites/site-b?material=MAT-COLLAR-25");

  await gotoApp(page, "/sites/site-b");
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Shortages 12" })).toBeVisible();

  await gotoApp(page, "/sites/site-b?material=MAT-COLLAR-25");
  await expect(page.getByText("Using Pipe collar for 25 mm pipe · 4 of 12")).toBeVisible();
  await expect(page.getByRole("link", { name: "Show all" })).toHaveAttribute("href", "/sites/site-b");
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(4);
  const collarRow = page.locator("a[href$='/penetrations/pen-b-01']");
  await expect(collarRow).toContainText("Substitutes");

  await gotoApp(page, "/sites/site-b?material=MAT-SEALANT");
  // One row per penetration, no solution group headings (user decision).
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);
  const pex = page.locator("a[href$='/penetrations/pen-b-01']");
  const kelox = page.locator("a[href$='/penetrations/pen-b-05']");
  await expect(pex).toContainText("L3, Riser 2 · PEX Pipe Ø25mm");
  await expect(pex).toContainText("Substitutes");
  await expect(kelox).toContainText("L4, Corridor south · KELOX Pipe - 13mm PE Ø32mm");
  expect((await pex.innerText()).replace(/\s+/g, " ").trim()).not.toBe((await kelox.innerText()).replace(/\s+/g, " ").trim());

  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-NOPE");
  await expect(page.getByText("That material is not a shortage on this site. Showing all penetrations.")).toBeVisible();
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);

  await gotoApp(page, "/sites/site-c/materials/MAT-MASTIC");
  await expect(page.getByRole("heading", { level: 1, name: "Fire mastic tube" })).toBeVisible();
  await expect(page.getByText("Kingsway Works, Phase 2 needs 1, stock unknown")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Planned at Kingsway Works, Phase 2: 1 penetration" })).toBeVisible();
  await expect(page.getByText("For the 1 penetration at this site", { exact: true })).toBeVisible();
  const masticState = page.getByText("No decision yet", { exact: true });
  await expect(masticState).toBeVisible();
  await expect(masticState.locator("svg")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Wait/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Escalate/ })).toBeVisible();
  // The place is text; the way on is up through the site list, filtered to this material.
  await expect(page.getByRole("link", { name: "L2, Plant room · Copper Pipe Ø40mm" })).toHaveCount(0);
  await page.getByRole("link", { name: "Show these on the site list" }).click();
  await expect(page).toHaveURL(/\/sites\/site-c\?material=MAT-MASTIC$/);
  await expect(page.locator("main a[href*='/penetrations/pen-c-']")).toHaveCount(1);
  await expect(page.locator("a[href$='/penetrations/pen-c-05']")).toContainText("Stock unknown");
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
