import { actionSentence, actionTarget, materialPagePath, shortageBrief } from "./format";
import { DECISION } from "./messages";
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

/** Compact chips for the site list: the kind of each problem. A decision is its own chip. Names and figures stay on the penetration page. */
export function listFactChips(
  penetrationId: string,
  shortages: readonly { readonly kind: "short" | "unknown"; readonly penetrationIds: readonly string[]; readonly state: string }[],
  blockers: readonly { readonly penetrationId: string; readonly reason: BlockerCode; readonly state: string }[],
): StatusView[] {
  const chips: StatusView[] = [];
  for (const blocker of blockers) {
    if (blocker.penetrationId === penetrationId) {
      chips.push({ label: LIST_BLOCKER[blocker.reason], tone: "danger", icon: "warning" });
    }
  }
  let short = 0;
  let unknown = 0;
  for (const shortage of shortages) {
    if (!shortage.penetrationIds.includes(penetrationId)) continue;
    if (shortage.kind === "short") short += 1;
    else unknown += 1;
  }
  if (short === 1) chips.push({ label: "Short material", tone: "danger", icon: "stop" });
  else if (short > 1) chips.push({ label: `Short material × ${short}`, tone: "danger", icon: "stop" });
  if (unknown === 1) chips.push({ label: "Stock unknown", tone: "warning", icon: "warning" });
  else if (unknown > 1) chips.push({ label: `Stock unknown × ${unknown}`, tone: "warning", icon: "warning" });
  return chips;
}

export interface DecisionLatest {
  readonly sentence: string;
  readonly recordedAt: string;
  readonly createdBy: string;
  readonly note: string | null;
}

export interface DecisionChip {
  readonly state: "escalated" | "waiting";
  readonly chip: StatusView;
  readonly latest: DecisionLatest;
}

interface DecisionAction {
  readonly kind: "wait" | "escalate";
  readonly escalateTo: "purchasing" | "warehouse" | null;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly current: boolean;
}

interface DecisionShortage {
  readonly id: string;
  readonly penetrationIds: readonly string[];
  readonly state: string;
  readonly actions: readonly DecisionAction[];
}

interface DecisionBlocker {
  readonly id: string;
  readonly penetrationId: string;
  readonly state: string;
  readonly actions: readonly DecisionAction[];
}

interface DecisionNames {
  readonly siteId: string;
  readonly materials: Readonly<Record<string, { readonly name: string }>>;
  readonly penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string }>>;
}

const DECISION_STATES = ["escalated", "waiting"] as const;

/** "Escalated, latest decision for L3, Riser 2 · PEX Pipe Ø25mm". The visible label comes first. */
export function decisionChipName(label: string, place: string): string {
  return `${label}, ${DECISION.latestFor} ${place}`;
}

/** On a tie, or when either date cannot be read, the one already found stays. */
function isNewer(candidate: string, current: string): boolean {
  const candidateMs = Date.parse(candidate);
  const currentMs = Date.parse(current);
  if (Number.isNaN(candidateMs) || Number.isNaN(currentMs) || candidateMs === currentMs) return false;
  return candidateMs > currentMs;
}

function latestOf(
  items: readonly { readonly id: string; readonly actions: readonly DecisionAction[] }[],
  kind: "wait" | "escalate",
  names: DecisionNames,
): DecisionLatest | null {
  let best: { readonly id: string; readonly action: DecisionAction } | null = null;
  for (const item of items) {
    for (const action of item.actions) {
      if (!action.current || action.kind !== kind) continue;
      if (best !== null && !isNewer(action.createdAt, best.action.createdAt)) continue;
      best = { id: item.id, action };
    }
  }
  if (best === null) return null;
  return {
    sentence: actionSentence(kind, best.action.escalateTo, actionTarget(names.siteId, best.id, names.materials, names.penetrations)),
    recordedAt: best.action.createdAt,
    createdBy: best.action.createdBy,
    note: best.action.note,
  };
}

/**
 * At most one chip per decision, escalated first. Which ones appear is the Acted filter's rule: a shortage
 * that lists this penetration, or this penetration's own blocker, in that state. The popover carries the
 * newest decision of that kind that still applies. No current action means no chip, never an empty popover.
 */
export function decisionChips(
  penetrationId: string,
  shortages: readonly DecisionShortage[],
  blockers: readonly DecisionBlocker[],
  names: DecisionNames,
): DecisionChip[] {
  const covering = [
    ...shortages.filter((shortage) => shortage.penetrationIds.includes(penetrationId)),
    ...blockers.filter((blocker) => blocker.penetrationId === penetrationId),
  ];
  const chips: DecisionChip[] = [];
  for (const state of DECISION_STATES) {
    const inState = covering.filter((item) => item.state === state);
    if (inState.length === 0) continue;
    const latest = latestOf(inState, state === "escalated" ? "escalate" : "wait", names);
    if (latest === null) continue;
    chips.push({ state, chip: shortageState(state), latest });
  }
  return chips;
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
