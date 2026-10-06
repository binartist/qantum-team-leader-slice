export type {
  ActionKind,
  Blocker,
  BlockerReason,
  FitField,
  CandidateResult,
  CandidateStatus,
  Catalogue,
  CrewStatus,
  EscalateTo,
  Orientation,
  Penetration,
  Shortage,
  ShortageAction,
  ShortageActionView,
  ShortageState,
  SiteReadiness,
  Solution,
  SolutionMaterial,
  StockBalance,
  SubstitutionProposal,
} from "./types";

export { isIncompleteSubstrate, normaliseText } from "./normalise";
export { buildCatalogue, type RawCatalogueRow } from "./catalogue";
export { computeSiteReadiness, type ReadinessInput } from "./readiness";
export {
  classifyActionsForList,
  deriveShortageState,
  isActionCurrent,
  viewActions,
  type ListedActionStatus,
  type ShortageLookup,
} from "./lifecycle";
export { findCandidates } from "./candidates";
export { solutionMismatches } from "./fit";
export {
  describeCandidateAvailability,
  type AvailabilityStatus,
  type CandidateAvailability,
  type CandidateOverall,
  type MaterialLine,
  type SiteShortageKinds,
} from "./availability";
export { isNonNegativeFinite, onHandFromQuantities, roundUpQuantity, snapQuantity } from "./quantities";
