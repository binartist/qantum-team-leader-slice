import { deriveShortageState, viewActions } from "./lifecycle";
import { isNonNegativeFinite, onHandFromQuantities, roundUpQuantity, snapQuantity } from "./quantities";
import type {
  Blocker,
  BlockerReason,
  Catalogue,
  Penetration,
  Shortage,
  ShortageAction,
  SiteReadiness,
  SolutionMaterial,
  StockBalance,
} from "./types";

export interface ReadinessInput {
  siteId: string;
  penetrations: readonly Penetration[];
  catalogue: Catalogue;
  solutionMaterials: readonly SolutionMaterial[];
  stock: readonly StockBalance[];
  actions: readonly ShortageAction[];
  asOf: string;
}

interface Requirement {
  sum: number;
  penetrationIds: string[];
}

function materialsByCode(rows: readonly SolutionMaterial[]): Map<string, SolutionMaterial[]> {
  const byCode = new Map<string, SolutionMaterial[]>();
  for (const row of rows) {
    const list = byCode.get(row.internalCode);
    if (list) list.push(row);
    else byCode.set(row.internalCode, [row]);
  }
  return byCode;
}

/** null means the material has rows, but a row or the sum is not a usable quantity. */
function stockOnHand(rows: readonly StockBalance[]): Map<string, number | null> {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const list = grouped.get(row.materialId);
    if (list) list.push(row.quantity);
    else grouped.set(row.materialId, [row.quantity]);
  }

  const onHand = new Map<string, number | null>();
  for (const [materialId, quantities] of grouped) {
    onHand.set(materialId, onHandFromQuantities(quantities));
  }
  return onHand;
}

function actionsForSite(siteId: string, actions: readonly ShortageAction[]): Map<string, ShortageAction[]> {
  const byShortage = new Map<string, ShortageAction[]>();
  for (const action of actions) {
    if (action.siteId !== siteId) continue;
    const list = byShortage.get(action.shortageId);
    if (list) list.push(action);
    else byShortage.set(action.shortageId, [action]);
  }
  return byShortage;
}

function addMaterial(requirements: Map<string, Requirement>, material: SolutionMaterial, penetrationId: string): void {
  const existing = requirements.get(material.materialId);
  if (!existing) {
    requirements.set(material.materialId, { sum: material.quantityPerInstall, penetrationIds: [penetrationId] });
    return;
  }
  existing.sum += material.quantityPerInstall;
  if (!existing.penetrationIds.includes(penetrationId)) existing.penetrationIds.push(penetrationId);
}

function buildShortage(
  siteId: string,
  materialId: string,
  requirement: Requirement,
  onHand: number | null | undefined,
  siteActions: ReadonlyMap<string, readonly ShortageAction[]>,
): Shortage | null {
  if (!Number.isFinite(requirement.sum)) {
    throw new RangeError("required quantity is not finite");
  }
  const requiredQty = roundUpQuantity(requirement.sum);
  const knownOnHand = typeof onHand === "number" ? onHand : null;
  if (knownOnHand !== null && requiredQty <= knownOnHand) return null;

  const shortfallQty = knownOnHand === null ? null : snapQuantity(requiredQty - knownOnHand);
  const id = `${siteId}:${materialId}`;
  const actions = viewActions(siteActions.get(id) ?? [], shortfallQty);
  return {
    id,
    siteId,
    materialId,
    kind: knownOnHand === null ? "unknown" : "short",
    requiredQty,
    onHandQty: knownOnHand,
    shortfallQty,
    penetrationIds: [...requirement.penetrationIds],
    state: deriveShortageState(actions),
    actions,
  };
}

function makeBlocker(
  siteId: string,
  penetration: Penetration,
  reason: BlockerReason,
  siteActions: ReadonlyMap<string, readonly ShortageAction[]>,
): Blocker {
  const id = `${siteId}:blocker.${penetration.id}`;
  const actions = viewActions(siteActions.get(id) ?? [], null);
  return {
    id,
    reason,
    penetrationId: penetration.id,
    internalCode: penetration.nominatedCode,
    state: deriveShortageState(actions),
    actions,
  };
}

function blockersAndRequirements(
  siteId: string,
  penetrations: readonly Penetration[],
  catalogue: Catalogue,
  materials: ReadonlyMap<string, readonly SolutionMaterial[]>,
  siteActions: ReadonlyMap<string, readonly ShortageAction[]>,
): { blockers: Blocker[]; requirements: Map<string, Requirement> } {
  const blockers: Blocker[] = [];
  const requirements = new Map<string, Requirement>();

  for (const penetration of penetrations) {
    if (!catalogue.byCode.has(penetration.nominatedCode)) {
      blockers.push(makeBlocker(siteId, penetration, "unknown_solution_code", siteActions));
      continue;
    }
    const mapped = materials.get(penetration.nominatedCode);
    if (mapped === undefined) {
      blockers.push(makeBlocker(siteId, penetration, "no_material_mapping", siteActions));
      continue;
    }
    if (mapped.some((material) => !isNonNegativeFinite(material.quantityPerInstall))) {
      blockers.push(makeBlocker(siteId, penetration, "invalid_quantity", siteActions));
      continue;
    }
    for (const material of mapped) addMaterial(requirements, material, penetration.id);
  }

  return { blockers, requirements };
}

export function computeSiteReadiness(input: ReadinessInput): SiteReadiness {
  const penetrations = input.penetrations.filter((penetration) => penetration.siteId === input.siteId);
  if (penetrations.length === 0) {
    return { siteId: input.siteId, crewStatus: "nothing_planned", shortages: [], blockers: [], asOf: input.asOf };
  }

  const siteActions = actionsForSite(input.siteId, input.actions);
  const { blockers, requirements } = blockersAndRequirements(
    input.siteId,
    penetrations,
    input.catalogue,
    materialsByCode(input.solutionMaterials),
    siteActions,
  );
  const onHand = stockOnHand(input.stock);
  const shortages = [...requirements.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .flatMap(([materialId, requirement]) => {
      const shortage = buildShortage(input.siteId, materialId, requirement, onHand.get(materialId), siteActions);
      return shortage ? [shortage] : [];
    });

  const crewStatus = shortages.length > 0 || blockers.length > 0 ? "blocked" : "clear";
  return { siteId: input.siteId, crewStatus, shortages, blockers, asOf: input.asOf };
}
