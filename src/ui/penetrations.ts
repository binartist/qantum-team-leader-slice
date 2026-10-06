import { materialPagePath, shortageBrief } from "./format";
import { availabilityStatus, blockerReason, shortageState, type AvailabilityChip, type BlockerCode, type FitFieldCode, type StatusView } from "./status";

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

function noteDecision(state: string, flags: { escalated: boolean; waiting: boolean }): void {
  if (state === "escalated") flags.escalated = true;
  else if (state === "waiting") flags.waiting = true;
}

/**
 * Icon marks for one site-list row. Problems are counted as before (a repeated kind keeps its full wording,
 * such as "Short material × 2"). A decision follows the Acted filter: at most one Escalated and one Waiting,
 * after the problems. Names and figures stay on the penetration page.
 */
export function rowMarks(
  penetrationId: string,
  shortages: readonly { readonly kind: "short" | "unknown"; readonly penetrationIds: readonly string[]; readonly state: string }[],
  blockers: readonly { readonly penetrationId: string; readonly reason: BlockerCode; readonly state: string }[],
): RowMark[] {
  const marks: RowMark[] = [];
  const decided = { escalated: false, waiting: false };
  for (const blocker of blockers) {
    if (blocker.penetrationId !== penetrationId) continue;
    marks.push({ label: LIST_BLOCKER[blocker.reason], tone: "danger", icon: "warning", count: 1 });
    noteDecision(blocker.state, decided);
  }
  let short = 0;
  let unknown = 0;
  for (const shortage of shortages) {
    if (!shortage.penetrationIds.includes(penetrationId)) continue;
    if (shortage.kind === "short") short += 1;
    else unknown += 1;
    noteDecision(shortage.state, decided);
  }
  if (short === 1) marks.push({ label: "Short material", tone: "danger", icon: "stop", count: 1 });
  else if (short > 1) marks.push({ label: `Short material × ${short}`, tone: "danger", icon: "stop", count: short });
  if (unknown === 1) marks.push({ label: "Stock unknown", tone: "warning", icon: "warning", count: 1 });
  else if (unknown > 1) marks.push({ label: `Stock unknown × ${unknown}`, tone: "warning", icon: "warning", count: unknown });
  if (decided.escalated) marks.push({ ...shortageState("escalated"), count: 1 });
  if (decided.waiting) marks.push({ ...shortageState("waiting"), count: 1 });
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
