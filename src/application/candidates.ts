import {
  describeCandidateAvailability,
  findCandidates,
  solutionMismatches,
  type CandidateAvailability,
  type CandidateStatus,
  type FitField,
  type Solution,
  type SiteShortageKinds,
  type SubstitutionProposal,
} from "@/domain";
import {
  IdempotencyKeyReusedError,
  NotACandidateError,
  PenetrationNotFoundError,
  SiteNotFoundError,
  StaleNominationError,
  ValidationFailedError,
  type NominatedPenetration,
} from "@/ports";
import { loadSiteData } from "./readiness";
import { uniqueIds, type Dependencies } from "./types";

export const CANDIDATE_NOTICE = "Catalogue match, not verified";

export interface CandidateView {
  readonly internalCode: string;
  readonly supplierRefCode: string;
  readonly orientation: Solution["orientation"];
  readonly substrateDetail: string;
  readonly serviceType: string;
  readonly serviceSize: string;
  readonly integrityMinutes: number;
  readonly insulationMinutes: number | null;
  /** Fields that do not fit this penetration. A catalogue match is usually none. */
  readonly mismatches: readonly FitField[];
  readonly availability: CandidateAvailability;
  readonly materials: Readonly<Record<string, { readonly name: string; readonly unit: string }>>;
}

export interface PenetrationSummary {
  readonly id: string;
  readonly floor: string;
  readonly location: string;
  readonly serviceType: string;
  readonly serviceSize: string;
  readonly nominatedCode: string;
  readonly requiredIntegrityMinutes: number | null;
  readonly requiredInsulationMinutes: number | null;
}

export interface CandidateList {
  readonly penetrationId: string;
  readonly nominatedCode: string;
  readonly status: CandidateStatus;
  readonly notice: typeof CANDIDATE_NOTICE;
  readonly penetration: PenetrationSummary;
  readonly candidates: readonly CandidateView[];
}

export interface ProposeSubstitutionInput {
  readonly siteId: string;
  readonly penetrationId: string;
  readonly fromInternalCode: string;
  readonly toInternalCode: string;
  readonly reason: string;
  readonly createdBy: string;
  readonly idempotencyKey: string;
}

async function requirePenetration(deps: Dependencies, siteId: string, penetrationId: string): Promise<NominatedPenetration> {
  const site = await deps.sites.getSite(siteId);
  if (!site) throw new SiteNotFoundError();
  const nominations = await deps.nominations.getNominations(siteId);
  if (nominations === null) throw new SiteNotFoundError();
  const penetration = nominations.find((item) => item.id === penetrationId);
  if (!penetration) throw new PenetrationNotFoundError();
  return penetration;
}

// A substitute that uses a material this site is already short of does not get the crew out of the shortage.
async function siteShortageKinds(deps: Dependencies, siteId: string): Promise<SiteShortageKinds> {
  const { readiness } = await loadSiteData(deps, siteId);
  return new Map(readiness.shortages.map((shortage) => [shortage.materialId, shortage.kind]));
}

export interface PenetrationDetail {
  readonly penetration: NominatedPenetration;
  /** The nominated solution's catalogue entry; null when the code is not in the catalogue. */
  readonly nominated: Solution | null;
  /** Fields on which the nominated solution does not fit the penetration (AC 35). */
  readonly mismatches: readonly FitField[];
  /** Product names the nominated solution needs, in mapping order. Empty when none are recorded. */
  readonly materialNames: readonly string[];
}

/** For the penetration page: both sides of the fit, for a side-by-side comparison (AC 36). Not an API route. */
export async function describePenetration(deps: Dependencies, siteId: string, penetrationId: string): Promise<PenetrationDetail> {
  const penetration = await requirePenetration(deps, siteId, penetrationId);
  const nominated = deps.catalogue.byCode.get(penetration.nominatedCode) ?? null;
  const mapped = await deps.solutionMaterials.getSolutionMaterials([penetration.nominatedCode]);
  const materialNames: string[] = [];
  const seen = new Set<string>();
  for (const item of mapped.items) {
    if (item.internalCode !== penetration.nominatedCode || seen.has(item.materialId)) continue;
    seen.add(item.materialId);
    materialNames.push(mapped.materials.find((material) => material.id === item.materialId)?.name ?? item.materialId);
  }
  return { penetration, nominated, mismatches: nominated ? solutionMismatches(penetration, nominated) : [], materialNames };
}

export async function listCandidates(deps: Dependencies, siteId: string, penetrationId: string): Promise<CandidateList> {
  const penetration = await requirePenetration(deps, siteId, penetrationId);
  const found = findCandidates(penetration, deps.catalogue);
  const codes = found.candidates.map((solution) => solution.internalCode);
  const mapped = codes.length === 0 ? { materials: [], items: [] } : await deps.solutionMaterials.getSolutionMaterials(codes);
  const materialIds = uniqueIds(mapped.items.map((item) => item.materialId));
  const stock = codes.length === 0 ? { asOf: "", balances: [] } : await deps.stock.getStock(materialIds);
  const siteShortages = codes.length === 0 ? new Map() : await siteShortageKinds(deps, siteId);

  const candidates = found.candidates.map((solution) => {
    const availability = describeCandidateAvailability(solution.internalCode, mapped.items, stock.balances, siteShortages);
    const materials: Record<string, { name: string; unit: string }> = {};
    for (const line of availability.lines) {
      const material = mapped.materials.find((item) => item.id === line.materialId);
      if (!material) continue;
      materials[material.id] = { name: material.name, unit: material.unit };
    }
    return {
      internalCode: solution.internalCode,
      supplierRefCode: solution.supplierRefCode,
      orientation: solution.orientation,
      substrateDetail: solution.substrateDetail,
      serviceType: solution.serviceType,
      serviceSize: solution.serviceSize,
      integrityMinutes: solution.integrityMinutes,
      insulationMinutes: solution.insulationMinutes,
      mismatches: solutionMismatches(penetration, solution),
      availability,
      materials,
    };
  });

  return {
    penetrationId: penetration.id,
    nominatedCode: penetration.nominatedCode,
    status: found.status,
    notice: CANDIDATE_NOTICE,
    penetration: {
      id: penetration.id,
      floor: penetration.floor,
      location: penetration.location,
      serviceType: penetration.serviceType,
      serviceSize: penetration.serviceSize,
      nominatedCode: penetration.nominatedCode,
      requiredIntegrityMinutes: penetration.requiredIntegrityMinutes,
      requiredInsulationMinutes: penetration.requiredInsulationMinutes,
    },
    candidates,
  };
}

export async function proposeSubstitution(
  deps: Dependencies,
  input: ProposeSubstitutionInput,
): Promise<{ record: SubstitutionProposal; created: boolean }> {
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) throw new ValidationFailedError(["reason"]);
  const existing = await deps.actions.findSubstitutionProposalByKey(input.createdBy, input.idempotencyKey);
  if (existing) {
    if (existing.siteId === input.siteId && existing.penetrationId === input.penetrationId) return { record: existing, created: false };
    throw new IdempotencyKeyReusedError();
  }
  const penetration = await requirePenetration(deps, input.siteId, input.penetrationId);
  if (input.fromInternalCode !== penetration.nominatedCode) throw new StaleNominationError();
  const found = findCandidates(penetration, deps.catalogue);
  const allowed = found.status === "ok" && found.candidates.some((solution) => solution.internalCode === input.toInternalCode);
  if (!allowed) throw new NotACandidateError();
  return deps.actions.appendSubstitutionProposal({
    siteId: input.siteId,
    penetrationId: input.penetrationId,
    fromInternalCode: input.fromInternalCode,
    toInternalCode: input.toInternalCode,
    reason,
    createdBy: input.createdBy,
    idempotencyKey: input.idempotencyKey,
  });
}
