import type { ActionKind, EscalateTo, Penetration, ShortageAction, SubstitutionProposal } from "@/domain";
import type { SolutionMaterialRecord, StockBalanceRecord } from "./schemas";

export type { InternalReason, UpstreamCode } from "./errors";
export {
  AppError,
  IdempotencyKeyRequiredError,
  IdempotencyKeyReusedError,
  InternalError,
  InvalidJsonError,
  NotACandidateError,
  PayloadTooLargeError,
  PenetrationNotFoundError,
  ShortageNotFoundError,
  SiteNotFoundError,
  StaleNominationError,
  UpstreamError,
  ValidationFailedError,
  WaitNotAllowedError,
} from "./errors";

export {
  IdSchema,
  MaterialSchema,
  NominatedPenetrationSchema,
  NominationsFileSchema,
  NominationsResponseSchema,
  SiteSchema,
  SitesFileSchema,
  SolutionMaterialSchema,
  SolutionMaterialsFileSchema,
  StockBalanceSchema,
  StockFileSchema,
} from "./schemas";

/** Domain penetration plus the display fields the screen needs. */
export interface NominatedPenetration extends Penetration {
  readonly floor: string;
  readonly location: string;
}

export interface Site {
  readonly id: string;
  readonly name: string;
  readonly reference: string;
  readonly address?: string;
}

export interface Material {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
}

export interface SitesPort {
  listSites(): Promise<Site[]>;
  getSite(siteId: string): Promise<Site | null>;
}

export interface NominationsPort {
  /** Null means the site is not in the upstream data. */
  getNominations(siteId: string): Promise<NominatedPenetration[] | null>;
}

export interface StockPort {
  getStock(materialIds: readonly string[]): Promise<{ asOf: string; balances: StockBalanceRecord[] }>;
}

export interface SolutionMaterialsPort {
  getSolutionMaterials(codes: readonly string[]): Promise<{ materials: Material[]; items: SolutionMaterialRecord[] }>;
}

export interface NewShortageAction {
  readonly siteId: string;
  readonly shortageId: string;
  readonly kind: ActionKind;
  readonly escalateTo: EscalateTo | null;
  readonly note: string | null;
  readonly shortfallQtyAtTime: number | null;
  readonly createdBy: string;
  readonly idempotencyKey: string;
}

export interface NewSubstitutionProposal {
  readonly siteId: string;
  readonly penetrationId: string;
  readonly fromInternalCode: string;
  readonly toInternalCode: string;
  readonly reason: string;
  readonly createdBy: string;
  readonly idempotencyKey: string;
}

export interface ActionsRepository {
  appendShortageAction(input: NewShortageAction): Promise<{ record: ShortageAction; created: boolean }>;
  appendSubstitutionProposal(input: NewSubstitutionProposal): Promise<{ record: SubstitutionProposal; created: boolean }>;
  findShortageActionByKey(createdBy: string, idempotencyKey: string): Promise<ShortageAction | null>;
  findSubstitutionProposalByKey(createdBy: string, idempotencyKey: string): Promise<SubstitutionProposal | null>;
  listShortageActions(siteId: string): Promise<ShortageAction[]>;
  listSubstitutionProposals(siteId: string): Promise<SubstitutionProposal[]>;
}

export type { SubstitutionProposal };
