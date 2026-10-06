import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("AC 30: shortage cards show material, need, have, short, affected count and state as text", async ({ page }) => {
  // Read-only. Expects untouched cards with no decision yet. The write project runs after this one.
  await gotoApp(page, "/sites/site-b");
  const sealant = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Intumescent sealant, 310 ml cartridge" }) });
  const collar = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Pipe collar for 25 mm pipe" }) });

  await expect(sealant.getByText("Need 10, have 8, short 2 cartridges")).toBeVisible();
  await expect(sealant.getByText("Affects 12 penetrations")).toBeVisible();
  await expect(collar.getByText("Need 4, have 2, short 2", { exact: true })).toBeVisible();
  await expect(collar.getByText("Affects 4 penetrations")).toBeVisible();

  for (const card of [sealant, collar]) {
    const label = card.getByText("No decision yet", { exact: true });
    await expect(label).toBeVisible();
    await expect(label.locator("svg")).toHaveCount(0);
  }

  const banner = page.locator("div").filter({ hasText: /^Blocked:/ }).first();
  await expect(banner).toBeVisible();
  await expect(banner.locator("svg[aria-hidden='true']")).toHaveCount(1);

  // The affected count opens the penetrations that use the material, on the filtered list.
  await expect(collar.getByRole("link", { name: "Affects 4 penetrations" })).toHaveAttribute("href", "/sites/site-b/penetrations?material=MAT-COLLAR-25");
  await collar.getByRole("link", { name: "Affects 4 penetrations" }).click();
  await expect(page.getByText("Using Pipe collar for 25 mm pipe · 4 of 12")).toBeVisible();
  await expect(page.getByRole("link", { name: "Show all" })).toHaveAttribute("href", "/sites/site-b/penetrations");
  await expect(page.getByRole("heading", { name: "Solution 0438 · 4" })).toBeVisible();
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(4);
  for (const id of ["pen-b-01", "pen-b-02", "pen-b-03", "pen-b-04"]) {
    const link = page.locator(`a[href$='/penetrations/${id}']`);
    await expect(link).toContainText("L3, Riser 2 · PEX Pipe Ø25mm");
    await expect(link).toContainText("Substitutes");
  }

  await gotoApp(page, "/sites/site-b");
  await sealant.getByRole("link", { name: "Affects 12 penetrations" }).click();
  await expect(page.getByRole("heading", { name: "Solution 0438 · 4" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solution 0434 · 3" })).toBeVisible();
  const pex = page.locator("a[href$='/penetrations/pen-b-01']");
  const kelox = page.locator("a[href$='/penetrations/pen-b-05']");
  await expect(pex).toContainText("L3, Riser 2 · PEX Pipe Ø25mm");
  await expect(pex).toContainText("Substitutes");
  await expect(kelox).toContainText("L4, Corridor south · KELOX Pipe - 13mm PE Ø32mm");
  expect((await pex.innerText()).replace(/\s+/g, " ").trim()).not.toBe((await kelox.innerText()).replace(/\s+/g, " ").trim());

  // A material that is not a shortage here shows everything and says so, never an empty list.
  await gotoApp(page, "/sites/site-b/penetrations?material=MAT-NOPE");
  await expect(page.getByText("That material is not a shortage on this site. Showing all penetrations.")).toBeVisible();
  await expect(page.locator("main a[href*='/penetrations/pen-b-']")).toHaveCount(12);

  await gotoApp(page, "/sites/site-c");
  const mastic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fire mastic tube" }) });
  await expect(mastic.getByText("Need 1, stock unknown")).toBeVisible();
  await expect(mastic.getByText("Affects 1 penetration")).toBeVisible();
  const masticState = mastic.getByText("No decision yet", { exact: true });
  await expect(masticState).toBeVisible();
  await expect(masticState.locator("svg")).toHaveCount(0);
  await expect(page.getByText(/^Blocked:/)).toBeVisible();
  await mastic.getByRole("link", { name: "Affects 1 penetration" }).click();
  const plant = page.locator("a[href$='/penetrations/pen-c-05']");
  await expect(plant).toContainText("L2, Plant room · Copper Pipe Ø40mm");
  await expect(page.getByRole("heading", { name: "Solution 0348 · 1" })).toBeVisible();
  await expect(plant).toContainText("Substitutes");
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
