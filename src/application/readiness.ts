import { computeSiteReadiness, type ShortageAction, type SiteReadiness } from "@/domain";
import { SiteNotFoundError, UpstreamError, type Material, type NominatedPenetration, type Site } from "@/ports";
import type { SolutionMaterialsPort, StockPort } from "@/ports";

type StockRead = Awaited<ReturnType<StockPort["getStock"]>>;
type SolutionMaterialsRead = Awaited<ReturnType<SolutionMaterialsPort["getSolutionMaterials"]>>;
import { uniqueIds, type Dependencies } from "./types";

export const STOCK_NOTICE = "On hand, shared, not reserved";

export interface SiteReadinessView extends SiteReadiness {
  readonly stockNotice: typeof STOCK_NOTICE;
  readonly stockAsOf: string;
  readonly materials: Readonly<Record<string, { readonly name: string; readonly unit: string }>>;
  readonly penetrations: Readonly<
    Record<
      string,
      {
        readonly floor: string;
        readonly location: string;
        readonly nominatedCode: string;
        readonly serviceType: string;
        readonly serviceSize: string;
      }
    >
  >;
}

function namedMaterials(materials: readonly Material[], wanted: ReadonlySet<string>): SiteReadinessView["materials"] {
  const result: Record<string, { name: string; unit: string }> = {};
  for (const material of materials) {
    if (!wanted.has(material.id) || result[material.id]) continue;
    result[material.id] = { name: material.name, unit: material.unit };
  }
  return result;
}

function materialsForShortages(readiness: SiteReadiness, materials: readonly Material[]): SiteReadinessView["materials"] {
  return namedMaterials(materials, new Set(readiness.shortages.map((shortage) => shortage.materialId)));
}

function materialsReferenced(
  items: readonly { readonly materialId: string }[],
  materials: readonly Material[],
): SiteReadinessView["materials"] {
  return namedMaterials(materials, new Set(items.map((item) => item.materialId)));
}

function penetrationsForReadiness(
  readiness: SiteReadiness,
  nominations: readonly NominatedPenetration[],
): SiteReadinessView["penetrations"] {
  const wanted = new Set<string>();
  for (const shortage of readiness.shortages) {
    for (const penetrationId of shortage.penetrationIds) wanted.add(penetrationId);
  }
  for (const blocker of readiness.blockers) wanted.add(blocker.penetrationId);
  const result: Record<string, { floor: string; location: string; nominatedCode: string; serviceType: string; serviceSize: string }> = {};
  for (const penetration of nominations) {
    if (!wanted.has(penetration.id)) continue;
    result[penetration.id] = {
      floor: penetration.floor,
      location: penetration.location,
      nominatedCode: penetration.nominatedCode,
      serviceType: penetration.serviceType,
      serviceSize: penetration.serviceSize,
    };
  }
  return result;
}

export interface SiteData {
  readonly readiness: SiteReadinessView;
  readonly shortageActions: readonly ShortageAction[];
  readonly referencedMaterials: SiteReadinessView["materials"];
  readonly sitePenetrations: SiteReadinessView["penetrations"];
}

function penetrationsForSite(nominations: readonly NominatedPenetration[]): SiteReadinessView["penetrations"] {
  const result: Record<string, { floor: string; location: string; nominatedCode: string; serviceType: string; serviceSize: string }> = {};
  for (const penetration of nominations) {
    result[penetration.id] = {
      floor: penetration.floor,
      location: penetration.location,
      nominatedCode: penetration.nominatedCode,
      serviceType: penetration.serviceType,
      serviceSize: penetration.serviceSize,
    };
  }
  return result;
}

/** Everything a site's readiness needs except the stock, so several sites can share one stock read. */
export interface SiteInputs {
  readonly site: Site;
  readonly nominations: readonly NominatedPenetration[];
  readonly solutionMaterials: SolutionMaterialsRead;
  readonly actions: readonly ShortageAction[];
  /** Every material the site's nominated solutions use: what the stock read must cover. */
  readonly materialIds: readonly string[];
}

export async function readSiteInputs(deps: Dependencies, siteId: string): Promise<SiteInputs> {
  const site = await deps.sites.getSite(siteId);
  if (!site) throw new SiteNotFoundError();
  const nominations = await deps.nominations.getNominations(siteId);
  if (nominations === null) throw new SiteNotFoundError();
  if (nominations.some((penetration) => penetration.siteId !== siteId)) {
    throw new UpstreamError("upstream_invalid", "nominations");
  }
  const codes = uniqueIds(nominations.map((penetration) => penetration.nominatedCode));
  const solutionMaterials = await deps.solutionMaterials.getSolutionMaterials(codes);
  const actions = await deps.actions.listShortageActions(siteId);
  const materialIds = uniqueIds(solutionMaterials.items.map((item) => item.materialId));
  return { site, nominations, solutionMaterials, actions, materialIds };
}

/** A site's readiness from its inputs and a stock read that covers its materials. */
export function buildSiteData(deps: Dependencies, inputs: SiteInputs, stock: StockRead): SiteData {
  const { site, nominations, solutionMaterials, actions } = inputs;
  const readiness = computeSiteReadiness({
    siteId: site.id,
    penetrations: nominations,
    catalogue: deps.catalogue,
    solutionMaterials: solutionMaterials.items,
    stock: stock.balances,
    actions,
    asOf: deps.now().toISOString(),
  });

  const view: SiteReadinessView = {
    ...readiness,
    stockNotice: STOCK_NOTICE,
    stockAsOf: stock.asOf,
    materials: materialsForShortages(readiness, solutionMaterials.materials),
    penetrations: penetrationsForReadiness(readiness, nominations),
  };
  return {
    readiness: view,
    shortageActions: actions,
    referencedMaterials: materialsReferenced(solutionMaterials.items, solutionMaterials.materials),
    sitePenetrations: penetrationsForSite(nominations),
  };
}

export async function loadSiteData(deps: Dependencies, siteId: string): Promise<SiteData> {
  const inputs = await readSiteInputs(deps, siteId);
  return buildSiteData(deps, inputs, await deps.stock.getStock(inputs.materialIds));
}

export async function getSiteReadiness(deps: Dependencies, siteId: string): Promise<SiteReadinessView> {
  return (await loadSiteData(deps, siteId)).readiness;
}
