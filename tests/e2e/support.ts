import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const screens = [
  "/",
  "/sites",
  "/sites/site-a",
  "/sites/site-b",
  "/sites/site-c",
  "/sites/site-d",
  "/sites/site-a/data-problems",
  "/sites/site-c/data-problems",
  "/sites/site-b/penetrations",
  "/sites/site-c/penetrations/pen-c-02",
  "/sites/site-c/penetrations",
  "/sites/site-a/penetrations/pen-a-01",
  "/sites/site-b/penetrations/pen-b-01",
  "/sites/site-b/materials/MAT-COLLAR-25",
  "/sites/site-b/materials/MAT-PUTTY",
  "/sites/site-c/materials/MAT-MASTIC",
  "/sites/site-b/penetrations/pen-b-10",
  "/sites/site-c/penetrations/pen-c-01",
  "/sites/site-c/penetrations/pen-c-03",
  "/sites/site-b/actions",
  "/sites/site-d/actions",
  "/sites/nope",
];

export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // A redirect route paints the loading shell, hydrates it, then navigates. Evaluating in that
  // gap loses the document. Wait until the page that landed has its own heading.
  await expect
    .poll(async () =>
      page
        .evaluate(() => {
          const heading = document.querySelector("h1")?.textContent ?? "";
          return document.documentElement.dataset.hydrated === "true" && heading !== "" && heading !== "Loading";
        })
        .catch(() => false),
    )
    .toBe(true);
}

export async function assertNoOverflow(page: Page): Promise<void> {
  const fits = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  expect(fits).toBe(true);
}

export async function assertTargets(page: Page): Promise<void> {
  // Measured in one pass inside the page, so a re-render between elements cannot leave a stale handle waiting.
  const failures = await page.evaluate(() => {
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, summary")) {
      if (element.getClientRects().length === 0) continue;
      // Inline links inside running text are exempt from the target size.
      if (element.tagName === "A" && element.closest("p") !== null) continue;
      // Content inside a closed disclosure cannot be tapped; the summary itself is checked.
      const details = element.closest("details");
      if (details !== null && !details.open && element.closest("summary") === null) continue;
      const box = element.getBoundingClientRect();
      if (box.width >= 44 && box.height >= 44) continue;
      const text = (element.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      const label = text || `<${element.tagName.toLowerCase()} id="${element.id}" aria-label="${element.getAttribute("aria-label") ?? ""}">`;
      found.push(`${box.width.toFixed(1)}x${box.height.toFixed(1)} ${label} on ${location.pathname}`);
    }
    return found;
  });
  // Next's dev-only indicator lives in a shadow root, which querySelectorAll does not enter.
  expect(failures).toEqual([]);
}

export async function assertAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const bad = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(
    bad.map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join("; ");
      return `${violation.impact ?? ""} ${violation.id}: ${violation.help} [${targets}]`;
    }),
  ).toEqual([]);
}

export async function tabTo(page: Page, pattern: RegExp): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const matched = await page.evaluate((source) => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || el === document.body) return false;
      const text = `${el.innerText} ${el.getAttribute("aria-label") ?? ""}`.replace(/\s+/g, " ");
      return new RegExp(source, "i").test(text);
    }, pattern.source);
    if (matched) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`No focused control matched ${pattern}`);
}
