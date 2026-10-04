import { classifyActionsForList, type ShortageAction, type ShortageLookup, type SubstitutionProposal } from "@/domain";
import { loadSiteData, type SiteReadinessView } from "./readiness";
import type { Dependencies } from "./types";

export interface ListedShortageAction extends ShortageAction {
  readonly status: "current" | "earlier" | "resolved";
}

export interface SiteActions {
  readonly actions: readonly ListedShortageAction[];
  readonly proposals: readonly SubstitutionProposal[];
  readonly materials: SiteReadinessView["materials"];
  readonly penetrations: SiteReadinessView["penetrations"];
}

function byNewest<T extends { createdAt: string }>(left: T, right: T): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs) || leftMs === rightMs) return 0;
  return leftMs > rightMs ? -1 : 1;
}

export async function listActions(deps: Dependencies, siteId: string): Promise<SiteActions> {
  const loaded = await loadSiteData(deps, siteId);
  const proposals = await deps.actions.listSubstitutionProposals(siteId);
  const storedActions = loaded.shortageActions;
  const lookups: ShortageLookup[] = [
    ...loaded.readiness.shortages,
    ...loaded.readiness.blockers.map((blocker) => ({ id: blocker.id, siteId: loaded.readiness.siteId, shortfallQty: null })),
  ];
  return {
    actions: classifyActionsForList(storedActions, lookups),
    proposals: [...proposals].sort(byNewest),
    materials: loaded.referencedMaterials,
    penetrations: loaded.sitePenetrations,
  };
}
