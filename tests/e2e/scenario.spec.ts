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
  await page.getByRole("link", { name: "Open sites" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
  await page.getByRole("link", { name: /Harbour Point/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Point, Levels 3 to 5" })).toBeVisible();
  await expect(page.getByText("On hand, shared, not reserved")).toBeVisible();
  await expect(page.getByText(/Blocked:/)).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);

  const sealant = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Intumescent sealant, 310 ml cartridge" }),
  });
  await sealant.getByRole("button", { name: /Escalate/ }).click();
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
  await expect(sealant.getByText("Escalated")).toBeVisible();
  await expect(page.getByText(/Blocked:/)).toBeVisible();
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

  await sealant.getByText("Penetrations and substitutes (12)").click();
  await sealant.locator("a[href$='pen-b-01']").click();
  const usesShort = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "0451" }) });
  const unmapped = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "0464" }) });
  await expect(page.getByText("Catalogue match, not verified")).toBeVisible();
  await expect(usesShort.getByText("Uses a material this site is short of.")).toBeVisible();
  await expect(page.getByText("Materials in stock")).toHaveCount(0);
  await expect(page.getByText("Fire rating: 60 min integrity, 30 min insulation")).toBeVisible();
  await expect(usesShort.getByText("Fire rating: 60 min integrity, 60 min insulation")).toBeVisible();
  await expect(usesShort.getByText("Meets the required rating")).toBeVisible();
  await expect(usesShort.getByText("Supplier ref V21.27-22SFR00053-158-E")).toBeVisible();
  await expect(usesShort.getByText("Fire putty pad x1")).toBeVisible();
  await expect(usesShort.getByText("on hand")).toHaveCount(0);
  await expect(unmapped.getByText("We can't tell if its materials are in stock.")).toBeVisible();

  await usesShort.getByRole("button", { name: /Propose this/ }).click();
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

  await page.getByRole("link", { name: "Actions log" }).click();
  await expect(page.getByRole("heading", { name: "Proposed substitute: 0438 to 0451" })).toBeVisible();
  await expect(page.getByText("Materials for this one are in stock")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escalated to purchasing: Intumescent sealant, 310 ml cartridge" })).toBeVisible();
  await expect(page.getByText("By demo-leader").first()).toBeVisible();
  await expect(page.getByText(/\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/).first()).toBeVisible();

  await gotoApp(page, "/sites");
  await page.getByRole("link", { name: /Kingsway Works/ }).click();
  await expect(page.getByRole("heading", { name: "Data problems" })).toBeVisible();
  await expect(page.getByText("Solution code 9999 isn't in the catalogue")).toBeVisible();
  await expect(page.getByText("No materials recorded for solution 0393")).toBeVisible();
  await expect(page.getByText("Crew can go")).toHaveCount(0);
});
