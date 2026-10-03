import { classifyActionsForList, type ShortageAction, type ShortageLookup, type SubstitutionProposal } from "@/domain";
import { getSiteReadiness } from "./readiness";
import type { Dependencies } from "./types";

export interface ListedShortageAction extends ShortageAction {
  readonly status: "current" | "earlier" | "resolved";
}

export interface SiteActions {
  readonly actions: readonly ListedShortageAction[];
  readonly proposals: readonly SubstitutionProposal[];
}

function byNewest<T extends { createdAt: string }>(left: T, right: T): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs) || leftMs === rightMs) return 0;
  return leftMs > rightMs ? -1 : 1;
}

export async function listActions(deps: Dependencies, siteId: string): Promise<SiteActions> {
  const readiness = await getSiteReadiness(deps, siteId);
  const [storedActions, proposals] = await Promise.all([
    deps.actions.listShortageActions(siteId),
    deps.actions.listSubstitutionProposals(siteId),
  ]);
  const lookups: ShortageLookup[] = [
    ...readiness.shortages,
    ...readiness.blockers.map((blocker) => ({ id: blocker.id, siteId: readiness.siteId, shortfallQty: null })),
  ];
  return {
    actions: classifyActionsForList(storedActions, lookups),
    proposals: [...proposals].sort(byNewest),
  };
}
