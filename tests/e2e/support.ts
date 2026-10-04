import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const screens = [
  "/",
  "/sites/site-a",
  "/sites/site-b",
  "/sites/site-c",
  "/sites/site-d",
  "/sites/site-a/penetrations/pen-a-01",
  "/sites/site-b/penetrations/pen-b-01",
  "/sites/site-b/penetrations/pen-b-10",
  "/sites/site-c/penetrations/pen-c-01",
  "/sites/site-c/penetrations/pen-c-03",
  "/sites/site-b/actions",
  "/sites/site-d/actions",
  "/sites/nope",
];

export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

export async function assertNoOverflow(page: Page): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fits).toBe(true);
}

export async function assertTargets(page: Page): Promise<void> {
  const handles = await page.locator("a, button, input, select, textarea, summary").all();
  const failures: string[] = [];
  for (const handle of handles) {
    const box = await handle.boundingBox();
    if (!box) continue;
    const inline = await handle.evaluate((element) => element.tagName === "A" && element.closest("p") !== null);
    if (inline) continue;
    // Next's dev-only indicator (absent from the production build) is not part of the app.
    const devTool = await handle.evaluate((element) => {
      const root = element.getRootNode();
      return root instanceof ShadowRoot && root.host.tagName.toLowerCase() === "nextjs-portal";
    });
    if (devTool) continue;
    // Content inside a closed disclosure cannot be tapped; the summary itself is checked.
    const hidden = await handle.evaluate((element) => {
      const details = element.closest("details");
      return details !== null && !details.open && element.closest("summary") === null;
    });
    if (hidden) continue;
    if (box.width < 44 || box.height < 44) {
      const label = await handle.evaluate((element) => {
        const text = ((element as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
        return text || `<${element.tagName.toLowerCase()} id="${element.id}" aria-label="${element.getAttribute("aria-label") ?? ""}">`;
      });
      failures.push(`${box.width.toFixed(1)}x${box.height.toFixed(1)} ${label} on ${page.url()}`);
    }
  }
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
