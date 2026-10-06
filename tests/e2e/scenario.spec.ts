import { expect, test, type Request } from "@playwright/test";
import { gotoApp } from "./support";

test("scenario: escalate sealant, propose 0451, then Kingsway still cannot go", async ({ page }) => {
  // Writes site-b sealant (site-b:MAT-SEALANT) and a proposal on pen-b-01.
  let releaseFirst: (() => void) | undefined;
  let held = false;
  await page.route("**/shortages/**/escalate", async (route) => {
    if (route.request().method() === "POST" && !held) {
      held = true;
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    }
    await route.continue();
  });

  await gotoApp(page, "/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Sites" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
  await page.getByRole("link", { name: /Harbour Point/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await expect(page.locator("a[href$='/penetrations/pen-b-01']")).toContainText("Short material");
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  // Row chips only name the problem; the shortage is briefed and linked on the penetration page.
  await page.locator("a[href$='/penetrations/pen-b-01']").click();
  await page.getByRole("link", { name: /^Short material: Intumescent sealant, 310 ml cartridge · this site short/ }).first().click();
  await expect(page).toHaveURL(/\/materials\/MAT-SEALANT\?from=pen-b-01#site-site-b$/);
  await page.getByRole("button", { name: "Escalate Intumescent sealant, 310 ml cartridge at Harbour Point, Levels 3 to 5" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("This does not release the crew.")).toBeVisible();
  await expect(dialog.getByText("This records your decision here. Nobody is notified automatically yet.")).toBeVisible();
  await expect(dialog.getByLabel("Send to")).toHaveValue("purchasing");
  await dialog.getByLabel("Note").fill("Order more sealant");

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/escalate") && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Send escalation" }).click();
  await expect.poll(() => held).toBe(true);
  const sending = dialog.getByRole("button", { name: "Sending…" });
  await expect(sending).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  releaseFirst?.();
  const response = await responsePromise;
  const key = response.request().headers()["idempotency-key"];
  const url = response.url();
  const body = response.request().postData() ?? "{}";
  expect(key).toBeTruthy();

  await expect(page.locator("[data-announcer]")).toHaveText("Escalation recorded");
  await expect(page.getByText("Escalated", { exact: true })).toBeVisible();
  // Back returns to the penetration that opened the material page, then up to the site.
  await page.getByRole("link", { name: "Back to L3, Riser 2" }).click();
  await expect(page).toHaveURL(/\/sites\/site-b\/penetrations\/pen-b-01$/);
  await page.getByRole("link", { name: "Back to Harbour Point, Levels 3 to 5" }).click();
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await expect(page.locator("a[href$='/penetrations/pen-b-01']")).toContainText("Short material");
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  await page.evaluate(
    async ({ target, idempotencyKey, payload }) => {
      await fetch(target, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey ?? "" },
        body: payload,
      });
    },
    { target: url, idempotencyKey: key, payload: body },
  );
  await expect(page.locator("[data-announcer]")).toHaveText("Already recorded");

  await gotoApp(page, "/sites/site-b?material=MAT-SEALANT");
  await expect(page.getByText("Using Intumescent sealant, 310 ml cartridge · 12 of 12")).toBeVisible();
  await page.locator("a[href$='/penetrations/pen-b-01']").click();
  const substitute = page.getByRole("region", { name: "Substitutes" });
  await expect(page.getByText("Catalogue match, not verified")).toBeVisible();
  await expect(substitute.getByRole("link", { name: /^Short material: Intumescent sealant, 310 ml cartridge · this site short 2 of 10$/ })).toBeVisible();
  await expect(page.getByText("Materials in stock")).toHaveCount(0);
  const fit = page.getByRole("region", { name: "Nominated solution 0438" }).getByRole("table");
  await expect(fit.getByRole("row", { name: /Integrity/ })).toContainText("60 min required");
  await expect(fit.getByRole("row", { name: /Insulation/ })).toContainText("30 min required");
  const substituteTable = substitute.getByRole("table");
  await expect(substituteTable.getByRole("columnheader", { name: "Solution 0451" })).toBeVisible();
  await expect(substituteTable.getByRole("row", { name: /Supplier ref/ })).toContainText("V21.27-22SFR00053-158-E");
  await expect(substitute.getByText("on hand")).toHaveCount(0);
  await page.getByLabel("Select candidate").selectOption("0464");
  await expect(substitute.getByText("We can't tell if its materials are in stock.")).toBeVisible();
  await page.getByLabel("Select candidate").selectOption("0451");

  await substitute.getByRole("button", { name: /Propose this/ }).click();
  const propose = page.getByRole("dialog");
  await expect(propose.getByText("A manager has to verify this catalogue match.")).toBeVisible();
  const posts: string[] = [];
  const recordPost = (request: Request) => {
    if (request.method() === "POST") posts.push(request.url());
  };
  page.on("request", recordPost);
  await propose.getByRole("button", { name: "Send proposal" }).click();
  await expect(propose.getByText("Give a reason.")).toBeVisible();
  expect(posts).toEqual([]);
  page.off("request", recordPost);

  await propose.getByLabel("Reason").fill("Materials for this one are in stock");
  await propose.getByRole("button", { name: "Send proposal" }).click();
  await expect(page.locator("[data-announcer]")).toHaveText("Proposal recorded");

  // The actions log opens from the header on this page.
  await page.getByRole("button", { name: /^Actions log/ }).click();
  const log = page.getByRole("dialog", { name: "Actions log" });
  // Each entry links back to the work it is about, and a proposal names its place.
  await expect(log.getByRole("heading", { name: "Proposed substitute for L3, Riser 2: 0438 to 0451" })).toBeVisible();
  await expect(log.getByRole("link", { name: "Proposed substitute for L3, Riser 2: 0438 to 0451" })).toHaveAttribute(
    "href",
    "/sites/site-b/penetrations/pen-b-01",
  );
  await expect(log.getByText("Materials for this one are in stock")).toBeVisible();
  await expect(log.getByRole("heading", { name: "Escalated to purchasing: Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  await expect(log.getByRole("link", { name: "Escalated to purchasing: Intumescent sealant, 310 ml cartridge" })).toHaveAttribute(
    "href",
    "/sites/site-b?material=MAT-SEALANT",
  );
  await expect(log.getByText("By demo-leader").first()).toBeVisible();
  await expect(log.getByText(/\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/).first()).toBeVisible();

  await gotoApp(page, "/sites");
  // A decision records intent; it creates no stock, so both sites are still blocked, for the same reasons.
  await expect(page.getByRole("listitem").filter({ hasText: "Harbour Point, Levels 3 to 5" }).getByText("Blocked · 2 shortages")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Kingsway Works, Phase 2" }).getByText("Blocked · 1 shortage, 4 data problems")).toBeVisible();
  await page.getByRole("link", { name: /Kingsway Works/ }).click();
  await expect(page.getByText("Blocked: hold the crew.")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Filter penetrations" }).getByRole("link", { name: "Data problems 4" }).click();
  await expect(page).toHaveURL(/show=data-problems/);
  await expect(page.locator("a[href$='/penetrations/pen-c-03']")).toContainText("Unknown solution");
  await expect(page.locator("a[href$='/penetrations/pen-c-04']")).toContainText("No materials");
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
