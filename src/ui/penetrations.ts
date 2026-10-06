import { materialPagePath, shortageBrief } from "./format";
import { availabilityStatus, blockerReason, type AvailabilityChip, type BlockerCode, type FitFieldCode, type StatusView } from "./status";

/** A per-penetration fact. On the penetration page a shortage links to its material page. */
export interface PenetrationFact extends StatusView {
  readonly href?: string;
}

/** A site's shortage of one material, as readiness gives it. */
interface SiteShortage {
  readonly materialId: string;
  readonly kind: "short" | "unknown";
  readonly requiredQty: number;
  readonly shortfallQty: number | null;
}

/** Which penetration's page a shortage line sits on, so the material page can return there (AC 42). */
interface LineSource {
  readonly siteId: string;
  readonly penetrationId: string;
}

/**
 * One material line on the penetration page. A site shortage is briefed with this site's figures and links
 * to the material page at this site's section, where it is decided (AC 40). A material that is not a site
 * shortage (only a substitute would run short of it) has nothing to decide, so it stays text.
 */
export function materialFact(name: string, status: "short" | "unknown", shortage: SiteShortage | undefined, source: LineSource): PenetrationFact {
  const tone: Pick<StatusView, "tone" | "icon"> = status === "short" ? { tone: "danger", icon: "stop" } : { tone: "warning", icon: "warning" };
  if (!shortage) return { label: status === "short" ? `Short material: ${name}` : `Stock unknown: ${name}`, ...tone };
  return { label: shortageBrief(name, shortage), ...tone, href: materialPagePath(shortage.materialId, source) };
}

/**
 * Facts that are true of one penetration on its own: a data problem that blocks it, and any short or
 * unknown-stock material its nominated solution uses. Never "ready": stock is shared across the site, so
 * no single penetration can be promised the materials.
 */
export function penetrationFacts(
  source: LineSource,
  shortages: readonly (SiteShortage & { readonly penetrationIds: readonly string[] })[],
  blockers: readonly {
    readonly penetrationId: string;
    readonly reason: BlockerCode;
    readonly internalCode: string;
    readonly mismatches?: readonly FitFieldCode[];
  }[],
  materials: Readonly<Record<string, { readonly name: string }>>,
): PenetrationFact[] {
  const facts: PenetrationFact[] = [];
  for (const blocker of blockers) {
    if (blocker.penetrationId === source.penetrationId) facts.push(blockerReason(blocker.reason, blocker.internalCode, blocker.mismatches));
  }
  for (const shortage of shortages) {
    if (!shortage.penetrationIds.includes(source.penetrationId)) continue;
    facts.push(materialFact(materials[shortage.materialId]?.name ?? shortage.materialId, shortage.kind, shortage, source));
  }
  return facts;
}

/** Problem lines for one substitute, in the same shape as the nominated solution's. In-stock materials are not listed. */
export function candidateFacts(
  availability: {
    readonly overall: AvailabilityChip;
    readonly lines: readonly { readonly materialId: string; readonly status: "in_stock" | "short" | "unknown" }[];
  },
  names: Readonly<Record<string, { readonly name: string }>>,
  shortages: readonly SiteShortage[],
  source: LineSource,
): PenetrationFact[] {
  const facts: PenetrationFact[] = [];
  for (const line of availability.lines) {
    if (line.status === "in_stock") continue;
    const shortage = shortages.find((item) => item.materialId === line.materialId);
    facts.push(materialFact(names[line.materialId]?.name ?? line.materialId, line.status, shortage, source));
  }
  if (facts.length === 0 && availability.overall !== "in_stock") facts.push(availabilityStatus(availability.overall));
  return facts;
}

const LIST_BLOCKER: Record<BlockerCode, string> = {
  unknown_solution_code: "Unknown solution",
  solution_mismatch: "Doesn't fit",
  no_material_mapping: "No materials",
  invalid_quantity: "Invalid quantity",
};

/** One icon on a site-list row. `label` is the full wording; `count` is 1 when the kind occurs once. */
export interface RowMark {
  readonly label: string;
  readonly tone: StatusView["tone"];
  readonly icon: StatusView["icon"];
  readonly count: number;
}

/** How many entries of each kind are in this penetration's Actions log. */
export interface DecisionCounts {
  readonly escalations: number;
  readonly waits: number;
  readonly proposals: number;
}

/** Counts the Actions log entries the row marks should agree with. */
export function logCounts(
  entries: readonly { readonly kind: "action" | "proposal"; readonly decision?: "wait" | "escalate" }[],
): DecisionCounts {
  let escalations = 0;
  let waits = 0;
  let proposals = 0;
  for (const entry of entries) {
    if (entry.kind === "proposal") proposals += 1;
    else if (entry.decision === "escalate") escalations += 1;
    else waits += 1;
  }
  return { escalations, waits, proposals };
}

function decisionCountMark(count: number, one: string, many: string, tone: RowMark["tone"], icon: RowMark["icon"]): RowMark | null {
  if (!(count > 0)) return null;
  return { label: count === 1 ? one : `${many} × ${count}`, tone, icon, count };
}

/**
 * Icon marks for one site-list row. Problems are counted as before (a repeated kind keeps its full wording,
 * such as "Short material × 2"). Decision marks count that penetration's Actions log, in order: escalated,
 * waiting, then proposed. A kind with no entries has no mark. Pass null when the log could not be read:
 * the row then shows problems only, never a zero.
 */
export function rowMarks(
  penetrationId: string,
  shortages: readonly { readonly kind: "short" | "unknown"; readonly penetrationIds: readonly string[]; readonly state: string }[],
  blockers: readonly { readonly penetrationId: string; readonly reason: BlockerCode; readonly state: string }[],
  decisions: DecisionCounts | null = null,
): RowMark[] {
  const marks: RowMark[] = [];
  for (const blocker of blockers) {
    if (blocker.penetrationId !== penetrationId) continue;
    marks.push({ label: LIST_BLOCKER[blocker.reason], tone: "danger", icon: "warning", count: 1 });
  }
  let short = 0;
  let unknown = 0;
  for (const shortage of shortages) {
    if (!shortage.penetrationIds.includes(penetrationId)) continue;
    if (shortage.kind === "short") short += 1;
    else unknown += 1;
  }
  if (short === 1) marks.push({ label: "Short material", tone: "danger", icon: "stop", count: 1 });
  else if (short > 1) marks.push({ label: `Short material × ${short}`, tone: "danger", icon: "stop", count: short });
  if (unknown === 1) marks.push({ label: "Stock unknown", tone: "warning", icon: "warning", count: 1 });
  else if (unknown > 1) marks.push({ label: `Stock unknown × ${unknown}`, tone: "warning", icon: "warning", count: unknown });
  if (decisions) {
    const escalated = decisionCountMark(decisions.escalations, "Escalated", "Escalated", "escalation", "arrow-up");
    const waiting = decisionCountMark(decisions.waits, "Waiting", "Waiting", "info", "clock");
    const proposed = decisionCountMark(decisions.proposals, "Proposed substitute", "Proposed substitutes", "neutral", "swap");
    if (escalated) marks.push(escalated);
    if (waiting) marks.push(waiting);
    if (proposed) marks.push(proposed);
  }
  return marks;
}

/**
 * Narrows the list to the penetrations whose solution uses one of this site's shortage materials. Only a
 * material that is a shortage here can filter; anything else shows the full list and says so, never an
 * empty list that could read as "nothing to worry about".
 */
export function filterByMaterial<T extends { readonly id: string }>(
  places: readonly T[],
  shortages: readonly { readonly materialId: string; readonly penetrationIds: readonly string[] }[],
  materials: Readonly<Record<string, { readonly name: string }>>,
  materialId: string | undefined,
): {
  places: readonly T[];
  filter: { materialName: string; shown: number; total: number } | null;
  unknownMaterial: boolean;
} {
  if (materialId === undefined) return { places, filter: null, unknownMaterial: false };
  const shortage = shortages.find((item) => item.materialId === materialId);
  if (!shortage) return { places, filter: null, unknownMaterial: true };
  const wanted = new Set(shortage.penetrationIds);
  const kept = places.filter((place) => wanted.has(place.id));
  return {
    places: kept,
    filter: { materialName: materials[materialId]?.name ?? materialId, shown: kept.length, total: places.length },
    unknownMaterial: false,
  };
}
