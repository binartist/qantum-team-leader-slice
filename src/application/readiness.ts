import { computeSiteReadiness, type SiteReadiness } from "@/domain";
import { SiteNotFoundError, UpstreamError, type Material, type NominatedPenetration } from "@/ports";
import { uniqueIds, type Dependencies } from "./types";

export const STOCK_NOTICE = "On hand, shared, not reserved";

export interface SiteReadinessView extends SiteReadiness {
  readonly stockNotice: typeof STOCK_NOTICE;
  readonly stockAsOf: string;
  readonly materials: Readonly<Record<string, { readonly name: string; readonly unit: string }>>;
  readonly penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string; readonly nominatedCode: string }>>;
}

function materialsForShortages(readiness: SiteReadiness, materials: readonly Material[]): SiteReadinessView["materials"] {
  const wanted = new Set(readiness.shortages.map((shortage) => shortage.materialId));
  const result: Record<string, { name: string; unit: string }> = {};
  for (const material of materials) {
    if (!wanted.has(material.id)) continue;
    result[material.id] = { name: material.name, unit: material.unit };
  }
  return result;
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

export async function getSiteReadiness(deps: Dependencies, siteId: string): Promise<SiteReadinessView> {
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

  return {
    ...readiness,
    stockNotice: STOCK_NOTICE,
    stockAsOf: stock.asOf,
    materials: materialsForShortages(readiness, solutionMaterials.materials),
    penetrations: penetrationsForReadiness(readiness, nominations),
  };
}
