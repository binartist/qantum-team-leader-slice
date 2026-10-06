import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("AC 30: a material page shows need, short, who it is planned on, and its state as text, per site", async ({ page }) => {
  // Read-only. Expects no decision yet. The write project runs after this one.
  await gotoApp(page, "/materials/MAT-SEALANT");
  await expect(page.getByRole("heading", { level: 1, name: "Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  // AC 39: the shared stock once, against every site's need; then each site that plans it.
  await expect(page.getByText("On hand 8 cartridges · planned across sites 12 cartridges", { exact: true })).toBeVisible();
  const harbour = page.getByRole("region", { name: "Harbour Point, Levels 3 to 5" });
  await expect(harbour.getByText("Needs 10, short 2 cartridges", { exact: true })).toBeVisible();
  // Identical places are one line; none is a link, so the page never loops back to a penetration.
  await expect(harbour.getByText("L3, Riser 2 · PEX Pipe Ø25mm ×4", { exact: true })).toBeVisible();
  await expect(harbour.getByText("L5, Plant room · Steel Pipe Ø28mm", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /L3, Riser 2/ })).toHaveCount(0);
  const riverside = page.getByRole("region", { name: "Riverside Plaza, Block A" });
  await expect(riverside.getByText("Needs 2, not short for this site alone", { exact: true })).toBeVisible();
  await expect(riverside.getByRole("button")).toHaveCount(0);

  await gotoApp(page, "/materials/MAT-COLLAR-25");
  const collar = page.getByRole("region", { name: "Harbour Point, Levels 3 to 5" });
  await expect(collar.getByText("Needs 4, short 2", { exact: true })).toBeVisible();
  // A wait or escalate covers the whole site's need, not one penetration.
  await expect(collar.getByText("For all 4 penetrations at this site", { exact: true })).toBeVisible();
  const collarState = collar.getByText("No decision yet", { exact: true });
  await expect(collarState).toBeVisible();
  await expect(collarState.locator("svg")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wait Pipe collar for 25 mm pipe at Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escalate Pipe collar for 25 mm pipe at Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(collar.getByText("L3, Riser 2 · PEX Pipe Ø25mm ×4", { exact: true })).toHaveCount(1);
  // Each site heading goes up to that site.
  await expect(collar.getByRole("link", { name: "Harbour Point, Levels 3 to 5" })).toHaveAttribute(
    "href",
    "/sites/site-b?fromMaterial=MAT-COLLAR-25",
  );

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

  await gotoApp(page, "/materials/MAT-MASTIC");
  await expect(page.getByRole("heading", { level: 1, name: "Fire mastic tube" })).toBeVisible();
  await expect(page.getByText("Stock unknown · planned across sites 1 tube", { exact: true })).toBeVisible();
  const kingsway = page.getByRole("region", { name: "Kingsway Works, Phase 2" });
  await expect(kingsway.getByText("Needs 1, stock unknown", { exact: true })).toBeVisible();
  await expect(kingsway.getByText("For the 1 penetration at this site", { exact: true })).toBeVisible();
  const masticState = kingsway.getByText("No decision yet", { exact: true });
  await expect(masticState).toBeVisible();
  await expect(masticState.locator("svg")).toHaveCount(0);
  await expect(kingsway.getByRole("button", { name: /Wait/ })).toBeVisible();
  await expect(kingsway.getByRole("button", { name: /Escalate/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "L2, Plant room · Copper Pipe Ø40mm" })).toHaveCount(0);
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
