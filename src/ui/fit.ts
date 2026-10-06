import { formatQuantity, tidy } from "./format";
import type { FitFieldCode } from "./status";

export interface FitRow {
  readonly label: string;
  readonly penetration: string;
  readonly solution: string;
  readonly fits: boolean;
}

// Matches the domain's rule: a substrate cut off after the family name ends in a comma.
function substrateText(raw: string, cutOffNote: string): string {
  return raw.trim().endsWith(",") ? `${tidy(raw)} (${cutOffNote})` : tidy(raw);
}

function required(minutes: number | null): string {
  return minutes === null ? "none required" : `${formatQuantity(minutes)} min required`;
}

function claimed(minutes: number | null): string {
  return minutes === null ? "none claimed" : `${formatQuantity(minutes)} min`;
}

/** The penetration and its nominated solution side by side; `fits` is false only for a field that does not fit (AC 36). */
export function fitRows(
  penetration: {
    readonly orientation: string;
    readonly substrateDetail: string;
    readonly serviceType: string;
    readonly serviceSize: string;
    readonly requiredIntegrityMinutes: number | null;
    readonly requiredInsulationMinutes: number | null;
  },
  solution: {
    readonly orientation: string;
    readonly substrateDetail: string;
    readonly serviceType: string;
    readonly serviceSize: string;
    readonly integrityMinutes: number;
    readonly insulationMinutes: number | null;
    readonly supplierRefCode: string;
  },
  mismatches: readonly FitFieldCode[],
): FitRow[] {
  const fits = (field: FitFieldCode) => !mismatches.includes(field);
  return [
    { label: "Orientation", penetration: penetration.orientation, solution: solution.orientation, fits: fits("orientation") },
    {
      label: "Substrate",
      penetration: substrateText(penetration.substrateDetail, "cut off"),
      solution: substrateText(solution.substrateDetail, "cut off in the catalogue"),
      fits: fits("substrate"),
    },
    { label: "Service", penetration: tidy(penetration.serviceType), solution: tidy(solution.serviceType), fits: fits("serviceType") },
    { label: "Size", penetration: tidy(penetration.serviceSize), solution: tidy(solution.serviceSize), fits: fits("serviceSize") },
    {
      label: "Integrity",
      penetration: required(penetration.requiredIntegrityMinutes),
      solution: claimed(solution.integrityMinutes),
      fits: fits("integrity"),
    },
    {
      label: "Insulation",
      penetration: required(penetration.requiredInsulationMinutes),
      solution: claimed(solution.insulationMinutes),
      fits: fits("insulation"),
    },
    // The penetration has no supplier ref; the dash says "not applicable" rather than leaving a blank cell.
    { label: "Supplier ref", penetration: "—", solution: tidy(solution.supplierRefCode), fits: true },
  ];
}
