export type MaterialTab = "stock" | "log";

/** Stock unless the query is the single value `log`. A repeated or unknown value stays on Stock. */
export function parseMaterialTab(value: string | string[] | undefined): MaterialTab {
  return value === "log" ? "log" : "stock";
}

/**
 * Tab link for one material. Keeps a valid `from` so back still returns to the penetration that opened
 * the page, and `fromLog` so a page opened from the actions log still returns there.
 */
export function materialTabHref(materialId: string, tab: MaterialTab, from?: string, fromLog?: string): string {
  const params = new URLSearchParams();
  if (tab === "log") params.set("tab", "log");
  if (from) params.set("from", from);
  if (fromLog) params.set("fromLog", fromLog);
  const query = params.toString();
  const path = `/materials/${encodeURIComponent(materialId)}`;
  return query.length === 0 ? path : `${path}?${query}`;
}
