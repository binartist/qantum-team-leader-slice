import { deriveShortageState, viewActions } from "./lifecycle";
import type {
  Blocker,
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

/** Sum first, then round up. The 1e6 step stops binary float dust from crossing an integer. */
const QUANTITY_SCALE = 1e6;

function snapQuantity(sum: number): number {
  return Math.round(sum * QUANTITY_SCALE) / QUANTITY_SCALE;
}

/** A negative or non-finite install quantity is not a credit against another penetration. */
function isUsableQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity >= 0;
}

interface Requirement {
  sum: number;
  penetrationIds: string[];
}

function roundUpQuantity(sum: number): number {
  return Math.ceil(snapQuantity(sum));
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
  const totals = new Map<string, { sum: number; invalid: boolean }>();
  for (const row of rows) {
    const current = totals.get(row.materialId) ?? { sum: 0, invalid: false };
    if (!Number.isFinite(row.quantity) || row.quantity < 0) {
      current.invalid = true;
    } else {
      current.sum += row.quantity;
      if (!Number.isFinite(current.sum)) current.invalid = true;
    }
    totals.set(row.materialId, current);
  }

  const onHand = new Map<string, number | null>();
  for (const [materialId, total] of totals) {
    const snapped = snapQuantity(total.sum);
    onHand.set(materialId, total.invalid || !Number.isFinite(snapped) ? null : snapped);
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

function blockersAndRequirements(
  penetrations: readonly Penetration[],
  catalogue: Catalogue,
  materials: ReadonlyMap<string, readonly SolutionMaterial[]>,
): { blockers: Blocker[]; requirements: Map<string, Requirement> } {
  const blockers: Blocker[] = [];
  const requirements = new Map<string, Requirement>();

  for (const penetration of penetrations) {
    if (!catalogue.byCode.has(penetration.nominatedCode)) {
      blockers.push({
        reason: "unknown_solution_code",
        penetrationId: penetration.id,
        internalCode: penetration.nominatedCode,
      });
      continue;
    }
    const mapped = materials.get(penetration.nominatedCode);
    if (mapped === undefined) {
      blockers.push({
        reason: "no_material_mapping",
        penetrationId: penetration.id,
        internalCode: penetration.nominatedCode,
      });
      continue;
    }
    if (mapped.some((material) => !isUsableQuantity(material.quantityPerInstall))) {
      blockers.push({
        reason: "invalid_quantity",
        penetrationId: penetration.id,
        internalCode: penetration.nominatedCode,
      });
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

  const { blockers, requirements } = blockersAndRequirements(penetrations, input.catalogue, materialsByCode(input.solutionMaterials));
  const onHand = stockOnHand(input.stock);
  const siteActions = actionsForSite(input.siteId, input.actions);
  const shortages = [...requirements.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .flatMap(([materialId, requirement]) => {
      const shortage = buildShortage(input.siteId, materialId, requirement, onHand.get(materialId), siteActions);
      return shortage ? [shortage] : [];
    });

  const crewStatus = shortages.length > 0 || blockers.length > 0 ? "blocked" : "clear";
  return { siteId: input.siteId, crewStatus, shortages, blockers, asOf: input.asOf };
}
