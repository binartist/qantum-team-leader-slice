import { onHandByMaterial, siteMaterialNeeds, type MaterialNeed, type Shortage } from "@/domain";
import { MaterialNotFoundError, SiteNotFoundError, UpstreamError, type Site } from "@/ports";
import { log } from "./log";
import { STOCK_NOTICE, buildSiteData, readSiteInputs, type SiteData, type SiteInputs } from "./readiness";
import { uniqueIds, type Dependencies } from "./types";

/** A planned penetration, as a material page names it. */
export interface MaterialPlace {
  readonly id: string;
  readonly floor: string;
  readonly location: string;
  readonly serviceType: string;
  readonly serviceSize: string;
  readonly nominatedCode: string;
}

/** One site's part in one material: what it needs and, when short, the shortage to decide on. */
export type MaterialSite =
  | {
      readonly status: "ready";
      readonly siteId: string;
      readonly siteName: string;
      readonly requiredQty: number;
      /** The penetrations that use the material, in the order the need lists them. */
      readonly places: readonly MaterialPlace[];
      /** Null when this site alone is not short of the material. */
      readonly shortage: Shortage | null;
    }
  | { readonly status: "unavailable"; readonly siteId: string; readonly siteName: string };

export interface MaterialStockSummary {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  /** Null when the stock figure is missing or unusable: unknown, never zero. */
  readonly onHandQty: number | null;
  /** Every checked site's need added up. Null when a site could not be checked. */
  readonly plannedQty: number | null;
  readonly neededSiteCount: number;
  /** Sites with a shortage of this material, including stock unknown. */
  readonly shortSiteCount: number;
}

interface StockFigures {
  readonly stockNotice: typeof STOCK_NOTICE;
  /** Null when no stock was read (nothing planned at the sites that could be checked). */
  readonly stockAsOf: string | null;
  /** When the page was computed, for the stock figures' age. */
  readonly asOf: string;
  /** Sites whose data could not be read. Their needs are unknown, so nothing is "not short" for sure. */
  readonly uncheckedSiteCount: number;
}

export interface MaterialStockList extends StockFigures {
  readonly materials: readonly MaterialStockSummary[];
}

/** The penetration a material page was opened from, when it is one it can return to (AC 42). */
export interface MaterialBack {
  readonly siteId: string;
  readonly penetrationId: string;
  readonly floor: string;
  readonly location: string;
}

export interface MaterialStockDetail extends StockFigures {
  readonly material: MaterialStockSummary;
  /** Sites that plan the material, in site order, then every site that could not be checked. */
  readonly sites: readonly MaterialSite[];
  readonly back: MaterialBack | null;
}

type Entry =
  | { readonly site: Site; readonly data: SiteData; readonly needs: readonly MaterialNeed[] }
  | { readonly site: Site; readonly data: null };

interface Snapshot {
  readonly entries: readonly Entry[];
  readonly names: ReadonlyMap<string, { readonly name: string; readonly unit: string }>;
  readonly onHand: ReadonlyMap<string, number | null>;
  readonly stockAsOf: string | null;
  readonly asOf: string;
  readonly uncheckedSiteCount: number;
  /** Every material a checked site needs, short or not. */
  readonly plannedIds: readonly string[];
}

/** A site that cannot be read is kept as unchecked; it never counts as having enough. */
async function readOrUnchecked(deps: Dependencies, site: Site): Promise<SiteInputs | null> {
  try {
    return await readSiteInputs(deps, site.id);
  } catch (error) {
    if (!(error instanceof UpstreamError) && !(error instanceof SiteNotFoundError)) throw error;
    log("site_unchecked", { siteId: site.id, code: error.code, ...(error instanceof UpstreamError ? { system: error.system } : {}) });
    return null;
  }
}

/**
 * Every site's inputs, then one stock read for all of them, so every figure on the page (the on-hand
 * amount and each site's shortage) comes from the same read.
 */
async function loadSnapshot(deps: Dependencies): Promise<Snapshot> {
  const sites = await deps.sites.listSites();
  const read = await Promise.all(sites.map(async (site) => ({ site, inputs: await readOrUnchecked(deps, site) })));
  // With no site readable there is nothing to list; an empty list would read as "nothing planned".
  if (read.length > 0 && read.every(({ inputs }) => inputs === null)) throw new UpstreamError("upstream_unavailable", "sites");

  const materialIds = uniqueIds(read.flatMap(({ inputs }) => inputs?.materialIds ?? []));
  const stock = materialIds.length === 0 ? null : await deps.stock.getStock(materialIds);
  const entries: Entry[] = read.map(({ site, inputs }) => {
    if (!inputs) return { site, data: null };
    const data = buildSiteData(deps, inputs, stock ?? { asOf: "", balances: [] });
    const needs = siteMaterialNeeds({
      siteId: site.id,
      penetrations: inputs.nominations,
      catalogue: deps.catalogue,
      solutionMaterials: inputs.solutionMaterials.items,
    });
    return { site, data, needs };
  });

  const names = new Map<string, { name: string; unit: string }>();
  for (const entry of entries) {
    for (const [id, material] of Object.entries(entry.data?.referencedMaterials ?? {})) names.set(id, material);
  }
  return {
    entries,
    names,
    onHand: onHandByMaterial(stock?.balances ?? []),
    stockAsOf: stock?.asOf ?? null,
    asOf: deps.now().toISOString(),
    uncheckedSiteCount: entries.filter((entry) => entry.data === null).length,
    plannedIds: uniqueIds(entries.flatMap((entry) => (entry.data ? entry.needs.map((need) => need.materialId) : []))),
  };
}

function placeOf(data: SiteData, penetrationId: string): MaterialPlace | null {
  const place = Object.hasOwn(data.sitePenetrations, penetrationId) ? data.sitePenetrations[penetrationId] : undefined;
  return place ? { id: penetrationId, ...place } : null;
}

function siteSection(entry: Entry, materialId: string): MaterialSite | null {
  const { site } = entry;
  if (!entry.data) return { status: "unavailable", siteId: site.id, siteName: site.name };
  const { data } = entry;
  const need = entry.needs.find((item) => item.materialId === materialId);
  if (!need) return null;
  return {
    status: "ready",
    siteId: site.id,
    siteName: site.name,
    requiredQty: need.requiredQty,
    places: need.penetrationIds.map((id) => placeOf(data, id)).filter((place) => place !== null),
    shortage: data.readiness.shortages.find((shortage) => shortage.materialId === materialId) ?? null,
  };
}

/** Planning sites in site order, then the unchecked ones. */
function sectionsFor(snapshot: Snapshot, materialId: string): MaterialSite[] {
  const sections = snapshot.entries.map((entry) => siteSection(entry, materialId)).filter((site) => site !== null);
  return [...sections.filter((site) => site.status === "ready"), ...sections.filter((site) => site.status === "unavailable")];
}

function summarise(snapshot: Snapshot, materialId: string, sites: readonly MaterialSite[]): MaterialStockSummary {
  const ready = sites.filter((site) => site.status === "ready");
  const named = snapshot.names.get(materialId);
  return {
    id: materialId,
    name: named?.name ?? materialId,
    unit: named?.unit ?? "",
    onHandQty: snapshot.onHand.get(materialId) ?? null,
    plannedQty: snapshot.uncheckedSiteCount > 0 ? null : ready.reduce((sum, site) => sum + site.requiredQty, 0),
    neededSiteCount: ready.length,
    shortSiteCount: ready.filter((site) => site.shortage !== null).length,
  };
}

function figures(snapshot: Snapshot): StockFigures {
  return { stockNotice: STOCK_NOTICE, stockAsOf: snapshot.stockAsOf, asOf: snapshot.asOf, uncheckedSiteCount: snapshot.uncheckedSiteCount };
}

/**
 * The penetration `from` names, when it is a penetration of a checked site that plans the material: one
 * whose shortage line (its nominated solution's, or a substitute's) opened this page. Anything else, null.
 */
function backFrom(snapshot: Snapshot, sites: readonly MaterialSite[], from: string | undefined): MaterialBack | null {
  if (from === undefined) return null;
  for (const site of sites) {
    if (site.status !== "ready") continue;
    const entry = snapshot.entries.find((item) => item.site.id === site.siteId);
    const place = entry?.data ? placeOf(entry.data, from) : null;
    if (place) return { siteId: site.siteId, penetrationId: from, floor: place.floor, location: place.location };
  }
  return null;
}

/** The materials list (AC 38): every material a checked site plans to use, by name. Page-only, no API route. */
export async function listMaterialStock(deps: Dependencies): Promise<MaterialStockList> {
  const snapshot = await loadSnapshot(deps);
  const materials = snapshot.plannedIds
    .map((id) => summarise(snapshot, id, sectionsFor(snapshot, id)))
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }) || left.id.localeCompare(right.id));
  return { ...figures(snapshot), materials };
}

/** One material across sites (AC 39), and where its back control returns (AC 42). Page-only, no API route. */
export async function describeMaterialStock(deps: Dependencies, materialId: string, from?: string): Promise<MaterialStockDetail> {
  const snapshot = await loadSnapshot(deps);
  const sites = sectionsFor(snapshot, materialId);
  if (!sites.some((site) => site.status === "ready")) {
    // With a site unchecked, the material may well be planned there: say "can't check", never "not found".
    if (sites.length > 0) throw new UpstreamError("upstream_unavailable", "sites");
    throw new MaterialNotFoundError();
  }
  return {
    ...figures(snapshot),
    material: summarise(snapshot, materialId, sites),
    sites,
    back: backFrom(snapshot, sites, from),
  };
}
