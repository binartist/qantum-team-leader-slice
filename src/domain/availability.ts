import { isNonNegativeFinite, onHandFromQuantities, roundUpQuantity } from "./quantities";
import type { SolutionMaterial, StockBalance } from "./types";

export type AvailabilityStatus = "in_stock" | "short" | "unknown";

export interface MaterialLine {
  readonly materialId: string;
  readonly quantityPerInstall: number;
  readonly requiredQty: number;
  readonly onHandQty: number | null;
  readonly status: AvailabilityStatus;
}

export type CandidateOverall = "in_stock" | "short" | "unknown" | "no_material_mapping" | "invalid_quantity";

export interface CandidateAvailability {
  readonly internalCode: string;
  readonly overall: CandidateOverall;
  readonly lines: readonly MaterialLine[];
}

export function describeCandidateAvailability(
  internalCode: string,
  solutionMaterials: readonly SolutionMaterial[],
  stock: readonly StockBalance[],
): CandidateAvailability {
  const rows = solutionMaterials.filter((row) => row.internalCode === internalCode);
  if (rows.length === 0) return { internalCode, overall: "no_material_mapping", lines: [] };
  if (rows.some((row) => !isNonNegativeFinite(row.quantityPerInstall))) {
    return { internalCode, overall: "invalid_quantity", lines: [] };
  }

  const totals = new Map<string, number>();
  for (const row of rows) {
    const current = totals.get(row.materialId);
    totals.set(row.materialId, (current ?? 0) + row.quantityPerInstall);
  }

  const lines: MaterialLine[] = [...totals.entries()].map(([materialId, quantityPerInstall]) => {
    const quantities: number[] = [];
    for (const balance of stock) {
      if (balance.materialId === materialId) quantities.push(balance.quantity);
    }
    const onHandQty = onHandFromQuantities(quantities);
    const requiredQty = roundUpQuantity(quantityPerInstall);
    let status: AvailabilityStatus;
    if (onHandQty === null) status = "unknown";
    else if (requiredQty <= onHandQty) status = "in_stock";
    else status = "short";
    return {
      materialId,
      quantityPerInstall,
      requiredQty,
      onHandQty,
      status,
    };
  });

  let overall: CandidateOverall = "in_stock";
  if (lines.some((line) => line.status === "short")) overall = "short";
  else if (lines.some((line) => line.status === "unknown")) overall = "unknown";
  return { internalCode, overall, lines };
}
