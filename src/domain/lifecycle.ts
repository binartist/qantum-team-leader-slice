import type { Shortage, ShortageAction, ShortageActionView, ShortageState } from "./types";

export type ListedActionStatus = "current" | "earlier" | "resolved";

function byCreatedAtDescending(left: ShortageAction, right: ShortageAction): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs) || leftMs === rightMs) return 0;
  return leftMs > rightMs ? -1 : 1;
}

export function isActionCurrent(action: ShortageAction, shortfallNow: number | null): boolean {
  const recorded = action.shortfallQtyAtTime;
  if (recorded === null || shortfallNow === null) return recorded === shortfallNow;
  return shortfallNow <= recorded;
}

export function deriveShortageState(actions: readonly ShortageActionView[]): ShortageState {
  let waiting = false;
  for (const action of actions) {
    if (!action.current) continue;
    if (action.kind === "escalate") return "escalated";
    waiting = true;
  }
  return waiting ? "waiting" : "open";
}

export function viewActions(actions: readonly ShortageAction[], shortfallNow: number | null): ShortageActionView[] {
  return [...actions].sort(byCreatedAtDescending).map((action) => ({
    ...action,
    current: isActionCurrent(action, shortfallNow),
  }));
}

export function classifyActionsForList(
  actions: readonly ShortageAction[],
  shortages: readonly Shortage[],
): Array<ShortageAction & { status: ListedActionStatus }> {
  return [...actions].sort(byCreatedAtDescending).map((action) => {
    const shortage = shortages.find((item) => item.id === action.shortageId && item.siteId === action.siteId);
    if (!shortage) return { ...action, status: "resolved" as const };
    const status = isActionCurrent(action, shortage.shortfallQty) ? ("current" as const) : ("earlier" as const);
    return { ...action, status };
  });
}
