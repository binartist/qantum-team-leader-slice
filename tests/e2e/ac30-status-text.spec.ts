import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test("AC 30: shortage cards show material, need, have, short, affected count and state as text", async ({ page }) => {
  // Read-only. Expects untouched Open cards. The write project runs after this one.
  await gotoApp(page, "/sites/site-b");
  const sealant = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Intumescent sealant, 310 ml cartridge" }) });
  const collar = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Pipe collar for 25 mm pipe" }) });

  await expect(sealant.getByText("Need 10, have 8, short 2 cartridge")).toBeVisible();
  await expect(sealant.getByText("Affects 12 penetrations")).toBeVisible();
  await expect(collar.getByText("Need 4, have 2, short 2 each")).toBeVisible();
  await expect(collar.getByText("Affects 4 penetrations")).toBeVisible();

  for (const card of [sealant, collar]) {
    const label = card.locator("span").filter({ has: page.locator("svg[aria-hidden='true']") }).locator("span");
    await expect(label).toHaveText("Open");
    await expect(label.locator("svg")).toHaveCount(0);
  }

  await collar.getByText("Show affected penetrations").click();
  for (const id of ["pen-b-01", "pen-b-02", "pen-b-03", "pen-b-04"]) {
    await expect(collar.locator(`a[href$='${id}']`)).toHaveText("L3, Riser 2");
  }

  const banner = page.locator("div").filter({ hasText: /^Blocked:/ }).first();
  await expect(banner).toBeVisible();
  await expect(banner.locator("svg[aria-hidden='true']")).toHaveCount(1);

  await gotoApp(page, "/sites/site-c");
  const mastic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fire mastic tube" }) });
  await expect(mastic.getByText("Need 1, stock unknown")).toBeVisible();
  await expect(mastic.getByText("Affects 1 penetration")).toBeVisible();
  const masticState = mastic.locator("span").filter({ has: page.locator("svg[aria-hidden='true']") }).locator("span");
  await expect(masticState).toHaveText("Open");
  await mastic.getByText("Show affected penetrations").click();
  await expect(mastic.locator("a[href$='pen-c-01']")).toHaveText("L1, Stair core");
  await expect(page.getByText(/^Blocked:/)).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
