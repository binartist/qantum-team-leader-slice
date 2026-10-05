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

  await collar.getByText("Penetrations and substitutes (4)").click();
  await expect(collar.getByText("Open a penetration to see possible substitutes.")).toBeVisible();
  await expect(collar.getByRole("heading", { name: "Solution 0438 · 4" })).toBeVisible();
  for (const id of ["pen-b-01", "pen-b-02", "pen-b-03", "pen-b-04"]) {
    const link = collar.locator(`a[href$='${id}']`);
    await expect(link).toContainText("L3, Riser 2 · PEX Pipe Ø25mm");
    await expect(link).toContainText("Substitutes");
  }

  await sealant.getByText("Penetrations and substitutes (12)").click();
  await expect(sealant.getByRole("heading", { name: "Solution 0438 · 4" })).toBeVisible();
  await expect(sealant.getByRole("heading", { name: "Solution 0434 · 3" })).toBeVisible();
  const pex = sealant.locator("a[href$='pen-b-01']");
  const kelox = sealant.locator("a[href$='pen-b-05']");
  await expect(pex).toContainText("L3, Riser 2 · PEX Pipe Ø25mm");
  await expect(pex).toContainText("Substitutes");
  await expect(kelox).toContainText("L4, Corridor south · KELOX Pipe - 13mm PE Ø32mm");
  expect((await pex.innerText()).replace(/\s+/g, " ").trim()).not.toBe((await kelox.innerText()).replace(/\s+/g, " ").trim());

  const banner = page.locator("div").filter({ hasText: /^Blocked:/ }).first();
  await expect(banner).toBeVisible();
  await expect(banner.locator("svg[aria-hidden='true']")).toHaveCount(1);

  await gotoApp(page, "/sites/site-c");
  const mastic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fire mastic tube" }) });
  await expect(mastic.getByText("Need 1, stock unknown")).toBeVisible();
  await expect(mastic.getByText("Affects 1 penetration")).toBeVisible();
  const masticState = mastic.getByText("No decision yet", { exact: true });
  await expect(masticState).toBeVisible();
  await expect(masticState.locator("svg")).toHaveCount(0);
  await mastic.getByText("Penetrations and substitutes (1)").click();
  const stair = mastic.locator("a[href$='pen-c-01']");
  await expect(stair).toContainText("L1, Stair core · Blank 50mm");
  await expect(mastic.getByRole("heading", { name: "Solution 0943 · 1" })).toBeVisible();
  await expect(stair).toContainText("Substitutes");
  await expect(page.getByText(/^Blocked:/)).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
