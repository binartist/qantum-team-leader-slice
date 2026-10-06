import { classifyActionsForList, type ShortageAction, type ShortageLookup, type SubstitutionProposal } from "@/domain";
import { SiteNotFoundError, UpstreamError, type Site } from "@/ports";
import { log } from "./log";
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

export type SiteActionsSection =
  | { readonly status: "ready"; readonly siteId: string; readonly siteName: string; readonly listed: SiteActions }
  | { readonly status: "unavailable"; readonly siteId: string; readonly siteName: string };

export interface AllActions {
  readonly sites: readonly SiteActionsSection[];
}

/** One site's log. A site that cannot be read stays in the list as unavailable; it is never skipped or treated as empty. */
async function sectionFor(deps: Dependencies, site: Site): Promise<SiteActionsSection> {
  try {
    return { status: "ready", siteId: site.id, siteName: site.name, listed: await listActions(deps, site.id) };
  } catch (error) {
    if (!(error instanceof UpstreamError) && !(error instanceof SiteNotFoundError)) throw error;
    log("actions_unchecked", { siteId: site.id, code: error.code, ...(error instanceof UpstreamError ? { system: error.system } : {}) });
    return { status: "unavailable", siteId: site.id, siteName: site.name };
  }
}

/** Every site's actions, in site order. Page only: there is no API route. */
export async function listAllActions(deps: Dependencies): Promise<AllActions> {
  const sites = await deps.sites.listSites();
  const sections = await Promise.all(sites.map((site) => sectionFor(deps, site)));
  // With no site readable there is nothing to list; an empty list would read as "nothing recorded".
  if (sites.length > 0 && sections.every((section) => section.status === "unavailable")) {
    throw new UpstreamError("upstream_unavailable", "sites");
  }
  return { sites: sections };
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
