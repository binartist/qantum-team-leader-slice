import { fromLogPath, penetrationPath } from "./format";

export type PenetrationTab = "solution" | "log";

/** Solution unless the query is the single value `log`. A repeated or unknown value stays on Solution. */
export function parsePenetrationTab(value: string | string[] | undefined): PenetrationTab {
  return value === "log" ? "log" : "solution";
}

/** Tab link for one penetration. Keeps `fromLog` when this page was opened from the actions log. */
export function penetrationTabHref(siteId: string, penetrationId: string, tab: PenetrationTab, fromLog?: string): string {
  const path = tab === "log" ? `${penetrationPath(siteId, penetrationId)}?tab=log` : penetrationPath(siteId, penetrationId);
  if (fromLog === undefined || fromLog.length === 0) return path;
  return fromLogPath(path, fromLog);
}
