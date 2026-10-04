import { describeCandidateAvailability, findCandidates, type CandidateAvailability, type CandidateStatus, type SubstitutionProposal } from "@/domain";
import {
  IdempotencyKeyReusedError,
  NotACandidateError,
  PenetrationNotFoundError,
  SiteNotFoundError,
  StaleNominationError,
  ValidationFailedError,
  type NominatedPenetration,
} from "@/ports";
import { uniqueIds, type Dependencies } from "./types";

export const CANDIDATE_NOTICE = "Catalogue match, not verified";

export interface CandidateView {
  readonly internalCode: string;
  readonly supplierRefCode: string;
  readonly serviceType: string;
  readonly serviceSize: string;
  readonly integrityMinutes: number;
  readonly insulationMinutes: number | null;
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

export async function listCandidates(deps: Dependencies, siteId: string, penetrationId: string): Promise<CandidateList> {
  const penetration = await requirePenetration(deps, siteId, penetrationId);
  const found = findCandidates(penetration, deps.catalogue);
  const codes = found.candidates.map((solution) => solution.internalCode);
  const mapped = codes.length === 0 ? { materials: [], items: [] } : await deps.solutionMaterials.getSolutionMaterials(codes);
  const materialIds = uniqueIds(mapped.items.map((item) => item.materialId));
  const stock = codes.length === 0 ? { asOf: "", balances: [] } : await deps.stock.getStock(materialIds);

  const candidates = found.candidates.map((solution) => {
    const availability = describeCandidateAvailability(solution.internalCode, mapped.items, stock.balances);
    const materials: Record<string, { name: string; unit: string }> = {};
    for (const line of availability.lines) {
      const material = mapped.materials.find((item) => item.id === line.materialId);
      if (!material) continue;
      materials[material.id] = { name: material.name, unit: material.unit };
    }
    return {
      internalCode: solution.internalCode,
      supplierRefCode: solution.supplierRefCode,
      serviceType: solution.serviceType,
      serviceSize: solution.serviceSize,
      integrityMinutes: solution.integrityMinutes,
      insulationMinutes: solution.insulationMinutes,
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
