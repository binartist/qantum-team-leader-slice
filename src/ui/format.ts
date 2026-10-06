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

export function formatNeed(required: number, onHand: number | null, shortfall: number | null, unit: string): string {
  if (onHand === null || shortfall === null) return `Need ${formatQuantity(required)}, stock unknown`;
  // The unit is printed once, beside the shortfall, so plural follows that number.
  const unitWord = formatUnit(shortfall, unit);
  const amounts = `Need ${formatQuantity(required)}, have ${formatQuantity(onHand)}, short ${formatQuantity(shortfall)}`;
  return unitWord.length > 0 ? `${amounts} ${unitWord}` : amounts;
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

export function formatMaterialSummary(
  lines: readonly { readonly materialId: string; readonly requiredQty: number; readonly onHandQty: number | null }[],
  materials: Readonly<Record<string, { readonly name: string }>>,
): string {
  return lines
    .map((line) => {
      const name = materials[line.materialId]?.name ?? line.materialId;
      return `${name} x${formatQuantity(line.requiredQty)}`;
    })
    .join(", ");
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

export function formatRating(integrity: number | null, insulation: number | null): string {
  return `Fire rating: ${ratingValue(integrity, insulation)}`;
}

export function supplierRefLine(code: string): string | null {
  const trimmed = code.trim();
  if (trimmed.length === 0) return null;
  return `Supplier ref ${trimmed}`;
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

// The solution code is the group heading, so a row names only the place and the service.
export function penetrationLine(place: PenetrationRow): string {
  return `${place.floor}, ${place.location} · ${tidy(place.serviceType)} ${tidy(place.serviceSize)}`;
}

export function penetrationGroups<T extends { readonly nominatedCode: string }>(
  places: readonly T[],
): { heading: string; places: T[] }[] {
  const groups: { code: string; places: T[] }[] = [];
  const index = new Map<string, { code: string; places: T[] }>();
  for (const place of places) {
    const existing = index.get(place.nominatedCode);
    if (existing) {
      existing.places.push(place);
      continue;
    }
    const created = { code: place.nominatedCode, places: [place] };
    index.set(place.nominatedCode, created);
    groups.push(created);
  }
  return groups.map((group) => ({
    heading: `Solution ${group.code} · ${group.places.length}`,
    places: group.places,
  }));
}

export function affectedCount(count: number): string {
  return count === 1 ? "Affects 1 penetration" : `Affects ${count} penetrations`;
}

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}

export function penetrationsPath(siteId: string, materialId?: string): string {
  const base = `/sites/${encodeURIComponent(siteId)}/penetrations`;
  return materialId === undefined ? base : `${base}?material=${encodeURIComponent(materialId)}`;
}

export function dataProblemsPath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}/data-problems`;
}

export function actionsPath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}/actions`;
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
 * Where a logged decision leads: a data problem to its penetration, a material shortage to the Penetrations
 * list filtered to that material. A resolved shortage has nothing to filter, so it has no link.
 */
export function actionLink(siteId: string, shortageId: string, status: "current" | "earlier" | "resolved"): string | null {
  const prefix = `${siteId}:`;
  const rest = shortageId.startsWith(prefix) ? shortageId.slice(prefix.length) : shortageId;
  if (rest.startsWith("blocker.")) {
    const penetrationId = rest.slice("blocker.".length);
    return penetrationId.length === 0 ? null : penetrationPath(siteId, penetrationId);
  }
  return status === "resolved" ? null : penetrationsPath(siteId, rest);
}
