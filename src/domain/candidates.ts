import { isIncompleteSubstrate, normaliseText } from "./normalise";
import type { CandidateResult, Catalogue, Penetration, Solution } from "./types";

function isCandidate(solution: Solution, penetration: Penetration, substrate: string, serviceType: string, serviceSize: string): boolean {
  if (solution.internalCode === penetration.nominatedCode) return false;
  if (solution.substrateIncomplete) return false;
  if (solution.orientation !== penetration.orientation) return false;
  if (solution.key.substrate !== substrate) return false;
  if (solution.key.serviceType !== serviceType) return false;
  if (solution.key.serviceSize !== serviceSize) return false;

  if (!Number.isFinite(solution.integrityMinutes)) return false;
  const requiredIntegrity = penetration.requiredIntegrityMinutes;
  if (requiredIntegrity !== null && solution.integrityMinutes < requiredIntegrity) return false;

  const offeredInsulation = solution.insulationMinutes;
  if (offeredInsulation !== null && !Number.isFinite(offeredInsulation)) return false;
  const requiredInsulation = penetration.requiredInsulationMinutes;
  if (requiredInsulation !== null) {
    if (offeredInsulation === null || offeredInsulation < requiredInsulation) return false;
  }
  return true;
}

export function findCandidates(penetration: Penetration, catalogue: Catalogue): CandidateResult {
  if (!catalogue.byCode.has(penetration.nominatedCode)) {
    return { status: "nominated_code_unknown", candidates: [] };
  }
  if (isIncompleteSubstrate(penetration.substrateDetail)) {
    return { status: "substrate_incomplete", candidates: [] };
  }
  const requiredIntegrity = penetration.requiredIntegrityMinutes;
  const requiredInsulation = penetration.requiredInsulationMinutes;
  if (
    (requiredIntegrity !== null && !Number.isFinite(requiredIntegrity)) ||
    (requiredInsulation !== null && !Number.isFinite(requiredInsulation))
  ) {
    return { status: "ok", candidates: [] };
  }

  const substrate = normaliseText(penetration.substrateDetail);
  const serviceType = normaliseText(penetration.serviceType);
  const serviceSize = normaliseText(penetration.serviceSize);
  const candidates = catalogue.solutions.filter((solution) => isCandidate(solution, penetration, substrate, serviceType, serviceSize));
  return { status: "ok", candidates };
}
