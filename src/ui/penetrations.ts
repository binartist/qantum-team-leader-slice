import { materialPath } from "./format";
import { blockerReason, type BlockerCode, type FitFieldCode, type StatusView } from "./status";

/** A per-penetration fact. A short material links to that material's stock page when the site is known. */
export interface PenetrationFact extends StatusView {
  readonly href?: string;
}

/**
 * Facts that are true of one penetration on its own: a data problem that blocks it, and any short or
 * unknown-stock material its nominated solution uses. Never "ready": stock is shared across the site, so
 * no single penetration can be promised the materials. A short material links to its stock page. Stock
 * unknown stays text: there is no on-hand figure to open.
 */
export function penetrationFacts(
  penetrationId: string,
  shortages: readonly { readonly materialId: string; readonly kind: "short" | "unknown"; readonly penetrationIds: readonly string[] }[],
  blockers: readonly {
    readonly penetrationId: string;
    readonly reason: BlockerCode;
    readonly internalCode: string;
    readonly mismatches?: readonly FitFieldCode[];
  }[],
  materials: Readonly<Record<string, { readonly name: string }>>,
  siteId?: string,
): PenetrationFact[] {
  const facts: PenetrationFact[] = [];
  for (const blocker of blockers) {
    if (blocker.penetrationId === penetrationId) facts.push(blockerReason(blocker.reason, blocker.internalCode, blocker.mismatches));
  }
  for (const shortage of shortages) {
    if (!shortage.penetrationIds.includes(penetrationId)) continue;
    const name = materials[shortage.materialId]?.name ?? shortage.materialId;
    facts.push(
      shortage.kind === "short"
        ? {
            label: `Short material: ${name}`,
            tone: "danger",
            icon: "stop",
            ...(siteId ? { href: materialPath(siteId, shortage.materialId) } : {}),
          }
        : { label: `Stock unknown: ${name}`, tone: "warning", icon: "warning" },
    );
  }
  return facts;
}

const LIST_BLOCKER: Record<BlockerCode, string> = {
  unknown_solution_code: "Unknown solution",
  solution_mismatch: "Doesn't fit",
  no_material_mapping: "No materials",
  invalid_quantity: "Invalid quantity",
};

/** Compact chips for the site list. Names and stock links stay on the penetration page. */
export function listFactChips(
  penetrationId: string,
  shortages: readonly { readonly kind: "short" | "unknown"; readonly penetrationIds: readonly string[] }[],
  blockers: readonly { readonly penetrationId: string; readonly reason: BlockerCode }[],
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
