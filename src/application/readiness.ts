import { computeSiteReadiness, type ShortageAction, type SiteReadiness } from "@/domain";
import { SiteNotFoundError, UpstreamError, type Material, type NominatedPenetration } from "@/ports";
import { uniqueIds, type Dependencies } from "./types";

export const STOCK_NOTICE = "On hand, shared, not reserved";

export interface SiteReadinessView extends SiteReadiness {
  readonly stockNotice: typeof STOCK_NOTICE;
  readonly stockAsOf: string;
  readonly materials: Readonly<Record<string, { readonly name: string; readonly unit: string }>>;
  readonly penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string; readonly nominatedCode: string }>>;
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
  const result: Record<string, { floor: string; location: string; nominatedCode: string }> = {};
  for (const penetration of nominations) {
    if (!wanted.has(penetration.id)) continue;
    result[penetration.id] = {
      floor: penetration.floor,
      location: penetration.location,
      nominatedCode: penetration.nominatedCode,
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
  const result: Record<string, { floor: string; location: string; nominatedCode: string }> = {};
  for (const penetration of nominations) {
    result[penetration.id] = {
      floor: penetration.floor,
      location: penetration.location,
      nominatedCode: penetration.nominatedCode,
    };
  }
  return result;
}

export async function loadSiteData(deps: Dependencies, siteId: string): Promise<SiteData> {
  const site = await deps.sites.getSite(siteId);
  if (!site) throw new SiteNotFoundError();
  const nominations = await deps.nominations.getNominations(siteId);
  if (nominations === null) throw new SiteNotFoundError();
  if (nominations.some((penetration) => penetration.siteId !== siteId)) {
    throw new UpstreamError("upstream_invalid", "nominations");
  }

  const codes = uniqueIds(nominations.map((penetration) => penetration.nominatedCode));
  const solutionMaterials = await deps.solutionMaterials.getSolutionMaterials(codes);
  const materialIds = uniqueIds(solutionMaterials.items.map((item) => item.materialId));
  const stock = await deps.stock.getStock(materialIds);
  const actions = await deps.actions.listShortageActions(siteId);
  const readiness = computeSiteReadiness({
    siteId,
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

export async function getSiteReadiness(deps: Dependencies, siteId: string): Promise<SiteReadinessView> {
  return (await loadSiteData(deps, siteId)).readiness;
}
