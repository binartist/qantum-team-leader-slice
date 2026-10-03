export type Orientation = "Wall" | "Floor" | "Ceiling";

export interface Solution {
  readonly internalCode: string;
  readonly supplierRefCode: string;
  readonly supplier: string;
  readonly orientation: Orientation;
  readonly substrateDetail: string;
  readonly substrateOption: string;
  readonly serviceClassification: string;
  readonly serviceType: string;
  readonly serviceTypeOption: string;
  readonly serviceSize: string;
  readonly integrityMinutes: number;
  readonly insulationMinutes: number | null;
  readonly key: { readonly substrate: string; readonly serviceType: string; readonly serviceSize: string };
  readonly substrateIncomplete: boolean;
}

export interface Catalogue {
  readonly solutions: readonly Solution[];
  readonly byCode: ReadonlyMap<string, Solution>;
  readonly incompleteCodes: readonly string[];
}

export interface Penetration {
  readonly id: string;
  readonly siteId: string;
  readonly orientation: Orientation;
  readonly substrateDetail: string;
  readonly serviceType: string;
  readonly serviceSize: string;
  readonly requiredIntegrityMinutes: number | null;
  readonly requiredInsulationMinutes: number | null;
  readonly nominatedCode: string;
}

export interface SolutionMaterial {
  readonly internalCode: string;
  readonly materialId: string;
  readonly quantityPerInstall: number;
}

export interface StockBalance {
  readonly materialId: string;
  readonly location: string;
  readonly quantity: number;
}

export type ActionKind = "wait" | "escalate";
export type EscalateTo = "purchasing" | "warehouse";

export interface ShortageAction {
  readonly id: string;
  readonly siteId: string;
  readonly shortageId: string;
  readonly kind: ActionKind;
  readonly escalateTo: EscalateTo | null;
  readonly note: string | null;
  readonly shortfallQtyAtTime: number | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface ShortageActionView extends ShortageAction {
  readonly current: boolean;
}

export type BlockerReason = "unknown_solution_code" | "no_material_mapping" | "invalid_quantity";

export interface Blocker {
  readonly reason: BlockerReason;
  readonly penetrationId: string;
  readonly internalCode: string;
}

export type ShortageState = "open" | "waiting" | "escalated";

export interface Shortage {
  readonly id: string;
  readonly siteId: string;
  readonly materialId: string;
  readonly kind: "short" | "unknown";
  readonly requiredQty: number;
  readonly onHandQty: number | null;
  readonly shortfallQty: number | null;
  readonly penetrationIds: readonly string[];
  readonly state: ShortageState;
  readonly actions: readonly ShortageActionView[];
}

export type CrewStatus = "clear" | "blocked" | "nothing_planned";

export interface SiteReadiness {
  readonly siteId: string;
  readonly crewStatus: CrewStatus;
  readonly shortages: readonly Shortage[];
  readonly blockers: readonly Blocker[];
  readonly asOf: string;
}

export type CandidateStatus = "ok" | "nominated_code_unknown" | "substrate_incomplete";

export interface CandidateResult {
  readonly status: CandidateStatus;
  readonly candidates: readonly Solution[];
}
