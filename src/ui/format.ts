const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatReference(reference: string): string {
  return `Job ref ${reference}`;
}

/** How much work the site check covered, from each planned penetration's nominated code. Null when nothing is planned. */
export function plannedWorkLine(nominatedCodes: readonly string[]): string | null {
  if (nominatedCodes.length === 0) return null;
  const penetrations = nominatedCodes.length;
  const solutions = new Set(nominatedCodes).size;
  return `${penetrations} ${penetrations === 1 ? "penetration" : "penetrations"}, ${solutions} ${solutions === 1 ? "solution" : "solutions"}`;
}

function snappedQuantity(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatQuantity(value: number): string {
  const snapped = snappedQuantity(value);
  if (snapped === null) return "unknown";
  if (Number.isInteger(snapped)) return String(snapped);
  return snapped.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

const UNIT_PLURAL: Readonly<Record<string, string>> = {
  cartridge: "cartridges",
  tube: "tubes",
  metre: "metres",
};

export function formatUnit(quantity: number, unit: string): string {
  if (unit === "each" || unit.length === 0) return "";
  const snapped = snappedQuantity(quantity);
  if (snapped === 1) return unit;
  return UNIT_PLURAL[unit] ?? `${unit}s`;
}

function utcStamp(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const month = MONTHS[date.getUTCMonth()]!;
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function ageMs(stockAsOf: string, asOf: string): number | null {
  const stock = Date.parse(stockAsOf);
  const request = Date.parse(asOf);
  if (Number.isNaN(stock) || Number.isNaN(request)) return null;
  const delta = request - stock;
  if (delta < 0) return null;
  return delta;
}

function agePhrase(deltaMs: number): string {
  if (deltaMs < HOUR_MS) {
    const minutes = Math.floor(deltaMs / MINUTE_MS);
    return minutes === 1 ? "1 minute old" : `${minutes} minutes old`;
  }
  if (deltaMs < DAY_MS) {
    const hours = Math.floor(deltaMs / HOUR_MS);
    return hours === 1 ? "1 hour old" : `${hours} hours old`;
  }
  const days = Math.floor(deltaMs / DAY_MS);
  return days === 1 ? "1 day old" : `${days} days old`;
}

export function stockFiguresLine(stockAsOf: string, asOf: string): string {
  const stamp = utcStamp(stockAsOf);
  if (!stamp) return "Stock figures from an unknown time";
  const delta = ageMs(stockAsOf, asOf);
  if (delta === null) return `Stock figures from ${stamp}`;
  return `Stock figures from ${stamp} (${agePhrase(delta)})`;
}

/** True only when the snapshot is strictly older than 24 hours. An unreadable or future time is not called stale. */
export function stockIsStale(stockAsOf: string, asOf: string): boolean {
  const delta = ageMs(stockAsOf, asOf);
  return delta !== null && delta > DAY_MS;
}

export function formatRecordedAt(iso: string): string {
  return utcStamp(iso) ?? "Time unknown";
}

export function characterCountLabel(value: string): string {
  return `${value.trim().length} of 500 characters`;
}

function ratingPart(minutes: number | null, kind: "integrity" | "insulation"): string {
  if (minutes === null) return kind === "integrity" ? "no integrity rating" : "no insulation rating";
  return `${formatQuantity(minutes)} min ${kind}`;
}

/** "90 min integrity, 60 min insulation", for a labelled field. */
export function ratingValue(integrity: number | null, insulation: number | null): string {
  return `${ratingPart(integrity, "integrity")}, ${ratingPart(insulation, "insulation")}`;
}

export interface PenetrationRow {
  readonly floor: string;
  readonly location: string;
  readonly serviceType: string;
  readonly serviceSize: string;
  readonly nominatedCode: string;
}

// Display only: catalogue text keeps its raw spacing for matching, the screen collapses runs of spaces.
export function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function serviceLine(place: Pick<PenetrationRow, "serviceType" | "serviceSize">): string {
  return `${tidy(place.serviceType)}, ${tidy(place.serviceSize)}`;
}

/** The site list is one row per penetration, named by its place and service. */
export function penetrationLine(place: PenetrationRow): string {
  return `${place.floor}, ${place.location} · ${tidy(place.serviceType)} ${tidy(place.serviceSize)}`;
}

/** Site-list order: floor, then location, then the service, so one place stays together. */
export function penetrationsByPlace<T extends PenetrationRow & { readonly id: string }>(places: readonly T[]): T[] {
  return [...places].sort(
    (a, b) =>
      a.floor.localeCompare(b.floor, undefined, { numeric: true }) ||
      a.location.localeCompare(b.location) ||
      a.serviceType.localeCompare(b.serviceType) ||
      a.serviceSize.localeCompare(b.serviceSize) ||
      a.id.localeCompare(b.id),
  );
}

/** A wait or escalate on a shortage covers every penetration that needs the material at this site. */
export function decisionScope(count: number): string {
  return count === 1 ? "For the 1 penetration at this site" : `For all ${count} penetrations at this site`;
}

function amount(quantity: number, unit: string): string {
  const unitWord = formatUnit(quantity, unit);
  return unitWord.length > 0 ? `${formatQuantity(quantity)} ${unitWord}` : formatQuantity(quantity);
}

/** One site's part on a material page. Not short is only ever "for this site alone": stock is shared. */
export function siteMaterialLine(
  required: number,
  shortage: { readonly kind: "short" | "unknown"; readonly shortfallQty: number | null } | null,
  unit: string,
): string {
  const need = `Needs ${formatQuantity(required)}`;
  if (shortage === null) return `${need}, not short for this site alone`;
  if (shortage.kind === "unknown" || shortage.shortfallQty === null) return `${need}, stock unknown`;
  return `${need}, short ${amount(shortage.shortfallQty, unit)}`;
}

/** A penetration's shortage line: the material and this site's figures, inline. */
export function shortageBrief(
  name: string,
  shortage: { readonly kind: "short" | "unknown"; readonly requiredQty: number; readonly shortfallQty: number | null },
): string {
  if (shortage.kind === "unknown" || shortage.shortfallQty === null) {
    return `Stock unknown: ${name} · this site needs ${formatQuantity(shortage.requiredQty)}`;
  }
  return `Short material: ${name} · this site short ${formatQuantity(shortage.shortfallQty)} of ${formatQuantity(shortage.requiredQty)}`;
}

/** Every site's need added up; empty when a site could not be checked, so no total is claimed. */
export function plannedAcrossLine(planned: number | null, unit: string): string {
  return planned === null ? "" : `Planned across sites ${amount(planned, unit)}`;
}

/** The shared stock against the across-sites need. The total is left out when a site could not be checked. */
export function materialStockLine(onHand: number | null, planned: number | null, unit: string): string {
  const stock = onHand === null ? "Stock unknown" : `On hand ${amount(onHand, unit)}`;
  return planned === null ? stock : `${stock} · planned across sites ${amount(planned, unit)}`;
}

export function shortSiteCount(count: number): string {
  return count === 1 ? "Short at 1 site" : `Short at ${count} sites`;
}

export function uncheckedSiteCount(count: number): string {
  return count === 1 ? "1 site couldn't be checked" : `${count} sites couldn't be checked`;
}

/** Identical place lines collapse into one, "×N" when repeated, in the order first seen. */
export function groupPlaces(labels: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => (count === 1 ? label : `${label} ×${count}`));
}

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}

/** The site screen opened from a material page, so its back control can return there. */
export function siteFromMaterialPath(siteId: string, materialId: string): string {
  return `${sitePath(siteId)}?fromMaterial=${encodeURIComponent(materialId)}`;
}

/** The site screen filtered to the penetrations that use one material. */
export function siteMaterialPath(siteId: string, materialId: string): string {
  return `${sitePath(siteId)}?material=${encodeURIComponent(materialId)}`;
}

export const MATERIALS_PATH = "/materials";

/** The anchor of one site's section on a material page. */
export function siteAnchor(siteId: string): string {
  return `site-${siteId}`;
}

/**
 * A material page. From a penetration, `from` lets the back control return there, and the anchor scrolls
 * to that site's section; the page itself always shows every site.
 */
export function materialPagePath(materialId: string, from?: { readonly siteId: string; readonly penetrationId?: string }): string {
  const base = `${MATERIALS_PATH}/${encodeURIComponent(materialId)}`;
  if (!from) return base;
  const query = from.penetrationId === undefined ? "" : `?from=${encodeURIComponent(from.penetrationId)}`;
  return `${base}${query}#${encodeURIComponent(siteAnchor(from.siteId))}`;
}

export function penetrationPath(siteId: string, penetrationId: string): string {
  return `/sites/${encodeURIComponent(siteId)}/penetrations/${encodeURIComponent(penetrationId)}`;
}

export function actionTarget(
  siteId: string,
  shortageId: string,
  materials: Readonly<Record<string, { readonly name: string }>>,
  penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string }>>,
): string {
  const prefix = `${siteId}:`;
  const rest = shortageId.startsWith(prefix) ? shortageId.slice(prefix.length) : shortageId;
  if (rest.startsWith("blocker.")) {
    const penetrationId = rest.slice("blocker.".length);
    if (penetrationId.length === 0) return shortageId;
    const place = penetrations[penetrationId];
    if (!place) return penetrationId;
    return `${place.floor}, ${place.location}`;
  }
  return materials[rest]?.name ?? rest;
}

export function actionSentence(
  kind: "wait" | "escalate",
  escalateTo: "purchasing" | "warehouse" | null,
  target: string,
): string {
  if (kind === "wait") return `Wait: ${target}`;
  if (escalateTo === "purchasing") return `Escalated to purchasing: ${target}`;
  if (escalateTo === "warehouse") return `Escalated to warehouse: ${target}`;
  return `Escalated: ${target}`;
}

export function proposalSentence(fromCode: string, toCode: string, place?: string): string {
  return place ? `Proposed substitute for ${place}: ${fromCode} to ${toCode}` : `Proposed substitute: ${fromCode} to ${toCode}`;
}

/**
 * Where a logged decision leads: a data problem to its penetration, a material shortage to the site list
 * filtered to that material. A resolved shortage has nothing to filter, so it has no link.
 */
export function actionLink(siteId: string, shortageId: string, status: "current" | "earlier" | "resolved"): string | null {
  const prefix = `${siteId}:`;
  const rest = shortageId.startsWith(prefix) ? shortageId.slice(prefix.length) : shortageId;
  if (rest.startsWith("blocker.")) {
    const penetrationId = rest.slice("blocker.".length);
    return penetrationId.length === 0 ? null : penetrationPath(siteId, penetrationId);
  }
  return status === "resolved" ? null : siteMaterialPath(siteId, rest);
}
