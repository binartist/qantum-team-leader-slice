import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

const TRANSPORT = "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice.";

test("a failed send keeps the idempotency key and does not announce success", async ({ page }) => {
  // Aborts both POSTs. Target is the site-c blocker for pen-c-03. Nothing is stored.
  const keys: string[] = [];
  await page.route("**/shortages/**/escalate", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    await route.abort();
  });

  await gotoApp(page, "/sites/site-c/data-problems");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "L1, Basement link" }) });
  await card.getByRole("button", { name: /Escalate/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Send escalation" }).click();
  await expect(dialog.getByText(TRANSPORT)).toBeVisible();
  await expect(page.locator("[data-announcer]")).not.toHaveText(/Escalation recorded|Already recorded/);

  await dialog.getByRole("button", { name: "Send escalation" }).click();
  await expect(dialog.getByText(TRANSPORT)).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
  await expect(page.locator("[data-announcer]")).not.toHaveText(/Escalation recorded|Already recorded/);
});
