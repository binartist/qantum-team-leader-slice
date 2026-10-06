import { expect, test } from "@playwright/test";
import { assertNoOverflow, assertTargets, gotoApp } from "./support";

// Read-only. Opens penetration pages; does not record an action.

test("a penetration page is titled by its place and split into Nominated solution and Substitutes", async ({ page }) => {
  await gotoApp(page, "/sites/site-c/penetrations/pen-c-04");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "L1, Atrium void" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 1, name: "Substitutes" })).toHaveCount(0);

  const nominated = page.getByRole("region", { name: "Nominated solution 0393" });
  const problem = nominated.getByText("No materials recorded for solution 0393");
  await expect(problem).toBeVisible();
  // Colour-coded, and never colour alone: the line carries an icon.
  await expect(problem.locator("xpath=..").locator("svg")).toHaveCount(1);

  const substitutes = page.getByRole("region", { name: "Substitutes" });
  await expect(substitutes.getByText("No catalogue match for this penetration. Escalate instead.")).toBeVisible();
  await expect(substitutes.getByRole("button", { name: /Escalate/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Actions log/ })).toBeVisible();
  await assertTargets(page);
  await assertNoOverflow(page);

  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  const nominated0438 = page.getByRole("region", { name: "Nominated solution 0438" });
  // A nominated solution that fits carries no mark anywhere in its comparison.
  const fitting = nominated0438.getByRole("table");
  await expect(fitting.getByText("doesn't fit")).toHaveCount(0);
  await expect(fitting.locator("svg")).toHaveCount(0);
  const subs = page.getByRole("region", { name: "Substitutes" });
  await expect(subs.getByText("Catalogue match, not verified")).toBeVisible();
  await expect(subs.getByRole("heading", { name: "Solution 0451" })).toBeVisible();
  await expect(subs.getByRole("columnheader", { name: "Solution 0451" })).toBeVisible();
  await expect(subs.getByRole("columnheader", { name: "Penetration" }).first()).toBeVisible();
});

test("AC 40: a shortage on the penetration page is a line with this site's figures, opening the material page at this site", async ({ page }) => {
  await gotoApp(page, "/sites/site-b/penetrations/pen-b-01");
  const nominated = page.getByRole("region", { name: "Nominated solution 0438" });
  const collar = nominated.getByRole("link", { name: "Short material: Pipe collar for 25 mm pipe · this site short 2 of 4" });
  const sealant = nominated.getByRole("link", { name: "Short material: Intumescent sealant, 310 ml cartridge · this site short 2 of 10" });
  await expect(collar).toHaveAttribute("href", "/materials/MAT-COLLAR-25?from=pen-b-01#site-site-b");
  await expect(sealant).toHaveAttribute("href", "/materials/MAT-SEALANT?from=pen-b-01#site-site-b");
  // A substitute's line links the same way when the site is already short of that material.
  const substitute = page.getByRole("region", { name: "Substitutes" });
  await expect(substitute.getByRole("link", { name: /^Short material: Intumescent sealant, 310 ml cartridge · this site short 2 of 10$/ })).toHaveAttribute(
    "href",
    "/materials/MAT-SEALANT?from=pen-b-01#site-site-b",
  );
  await collar.click();
  await expect(page).toHaveURL(/\/materials\/MAT-COLLAR-25\?from=pen-b-01#site-site-b$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pipe collar for 25 mm pipe" })).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();
  const harbour = page.getByRole("region", { name: "Harbour Point, Levels 3 to 5" });
  await expect(harbour.getByText("Needs 4, short 2", { exact: true })).toBeVisible();
  await expect(page.locator("#site-site-b")).toBeInViewport();

  // Stock unknown is a shortage too: briefed, linked, and decided on the material page.
  await gotoApp(page, "/sites/site-c/penetrations/pen-c-05");
  const mastic = page.getByRole("link", { name: "Stock unknown: Fire mastic tube · this site needs 1" });
  await expect(mastic).toHaveAttribute("href", "/materials/MAT-MASTIC?from=pen-c-05#site-site-c");
});

test("AC 42: a material page returns to the penetration that opened it, and otherwise to Materials", async ({ page }) => {
  await gotoApp(page, "/materials/MAT-COLLAR-25?from=pen-b-01#site-site-b");
  await page.getByRole("link", { name: "Back to L3, Riser 2" }).click();
  await expect(page).toHaveURL(/\/sites\/site-b\/penetrations\/pen-b-01$/);

  await gotoApp(page, "/materials/MAT-MASTIC?from=pen-c-05#site-site-c");
  await expect(page.getByRole("link", { name: "Back to L2, Plant room" })).toHaveAttribute("href", "/sites/site-c/penetrations/pen-c-05");

  // A penetration of a site that does not plan the material, a made-up id, an object key, a malformed or a
  // repeated value: all go back to Materials.
  for (const query of ["?from=pen-c-05", "?from=pen-none", "?from=constructor", "?from=not%20an%20id", "?from=pen-b-01&from=pen-b-02", ""]) {
    await gotoApp(page, `/materials/MAT-COLLAR-25${query}`);
    await expect(page.getByRole("link", { name: "Back to Materials" }), query).toHaveAttribute("href", "/materials");
  }
  await assertTargets(page);
  await assertNoOverflow(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("heading", { level: 1, name: "Pipe collar for 25 mm pipe" })).toBeVisible();
  await assertNoOverflow(page);
});

test("AC 41: the old site-scoped material URL opens the material page at that site", async ({ page }) => {
  await gotoApp(page, "/sites/site-b/materials/MAT-SEALANT");
  await expect(page).toHaveURL(/\/materials\/MAT-SEALANT#site-site-b$/);
  await expect(page.getByRole("region", { name: "Harbour Point, Levels 3 to 5" }).getByText("Needs 10, short 2 cartridges", { exact: true })).toBeVisible();
  await expect(page.locator("#site-site-b")).toBeInViewport();

  // Bad ids, and a material no site plans, are not found.
  for (const path of ["/sites/not%20an%20id/materials/MAT-SEALANT", "/sites/site-a/materials/MAT-PUTTY", "/materials/MAT-PUTTY", "/materials/not%20an%20id"]) {
    await gotoApp(page, path);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" }), path).toBeVisible();
  }
});

test("AC 36: the nominated solution sits side by side with the penetration, and a field that does not fit is marked", async ({ page }) => {
  await gotoApp(page, "/sites/site-c/penetrations/pen-c-02");
  await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "L1, Riser 1" })).toBeVisible();
  const nominated = page.getByRole("region", { name: "Nominated solution 0435" });
  // AC 35: the mismatch is a data problem, named by its field.
  await expect(nominated.getByText("Solution 0435 doesn't fit this penetration: insulation")).toBeVisible();

  const table = nominated.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "Penetration" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Solution 0435" })).toBeVisible();
  for (const field of ["Orientation", "Substrate", "Service", "Size", "Integrity", "Insulation", "Supplier ref"]) {
    await expect(table.getByRole("rowheader", { name: field, exact: true })).toBeVisible();
  }
  const insulation = table.getByRole("row", { name: /Insulation/ });
  await expect(insulation).toContainText("90 min required");
  await expect(insulation.getByText("60 min, doesn't fit")).toBeVisible();
  // Marked with an icon as well as colour.
  await expect(insulation.locator("svg")).toHaveCount(1);
  // Fields that fit carry no mark.
  await expect(table.getByRole("row", { name: /Integrity/ }).locator("svg")).toHaveCount(0);
  await expect(table.getByText("doesn't fit")).toHaveCount(1);
  await assertTargets(page);
  await assertNoOverflow(page);
});

test("AC 35: a nominated solution that does not fit is a data problem on the site", async ({ page }) => {
  await gotoApp(page, "/sites/site-c/data-problems");
  await expect(page).toHaveURL(/show=data-problems/);
  // The row chip names the kind of problem; the penetration page carries the full reason.
  const riser = page.locator("a[href$='/penetrations/pen-c-02']");
  await expect(riser).toContainText("Doesn't fit");
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await riser.click();
  await expect(page.getByText("Solution 0435 doesn't fit this penetration: insulation")).toBeVisible();
  await expect(page.getByRole("button", { name: /Escalate/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Wait/ })).toHaveCount(0);
});

test("a nominated code missing from the catalogue has no comparison, only the penetration's own fields", async ({ page }) => {
  await gotoApp(page, "/sites/site-c/penetrations/pen-c-03");
  const nominated = page.getByRole("region", { name: "Nominated solution 9999" });
  await expect(nominated.getByText("Solution code 9999 isn't in the catalogue")).toBeVisible();
  await expect(nominated.getByRole("table")).toHaveCount(0);
  await expect(nominated.getByText("Required rating")).toBeVisible();
  await expect(nominated.getByText("60 min integrity, 60 min insulation")).toBeVisible();
});

test("AC 35: a cut-off catalogue substrate never fits, and the page says why", async ({ page }) => {
  await gotoApp(page, "/sites/site-c/penetrations/pen-c-01");
  const nominated = page.getByRole("region", { name: "Nominated solution 0943" });
  await expect(nominated.getByText("Solution 0943 doesn't fit this penetration: substrate")).toBeVisible();
  const substrate = nominated.getByRole("table").getByRole("row", { name: /Substrate/ });
  await expect(substrate).toContainText("FR plasterboard, (cut off)");
  await expect(substrate.getByText("FR plasterboard, (cut off in the catalogue), doesn't fit")).toBeVisible();
  // AC 21 still holds: no substitutes for an incomplete catalogue substrate.
  await expect(page.getByRole("region", { name: "Substitutes" }).getByText(/substrate is incomplete/)).toBeVisible();
});

