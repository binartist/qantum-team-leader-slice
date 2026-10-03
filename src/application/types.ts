import type { Catalogue } from "@/domain";
import type { ActionsRepository, NominationsPort, SitesPort, SolutionMaterialsPort, StockPort } from "@/ports";

export interface Dependencies {
  readonly sites: SitesPort;
  readonly nominations: NominationsPort;
  readonly stock: StockPort;
  readonly solutionMaterials: SolutionMaterialsPort;
  readonly catalogue: Catalogue;
  readonly actions: ActionsRepository;
  readonly now: () => Date;
}

export function uniqueIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
