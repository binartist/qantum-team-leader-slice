import { isIncompleteSubstrate, normaliseText } from "./normalise";
import { isNonNegativeFinite } from "./quantities";
import type { FitField, Penetration, Solution } from "./types";

/**
 * The fields on which a nominated solution does not fit its penetration, in a fixed order. Text compares
 * with the same normalisation as substitute matching, so spacing and capitals never count. A substrate cut off
 * after the family name, on either side, never fits: it cannot identify a build-up, even against identical
 * cut-off text. Blank text, or a requirement or rating that cannot be compared, also fails closed.
 */
export function solutionMismatches(penetration: Penetration, solution: Solution): FitField[] {
  const fields: FitField[] = [];
  if (penetration.orientation !== solution.orientation) fields.push("orientation");
  const cutOff = isIncompleteSubstrate(penetration.substrateDetail) || solution.substrateIncomplete;
  if (cutOff || !sameText(penetration.substrateDetail, solution.key.substrate)) fields.push("substrate");
  if (!sameText(penetration.serviceType, solution.key.serviceType)) fields.push("serviceType");
  if (!sameText(penetration.serviceSize, solution.key.serviceSize)) fields.push("serviceSize");
  if (!meets(penetration.requiredIntegrityMinutes, solution.integrityMinutes)) fields.push("integrity");
  if (!meets(penetration.requiredInsulationMinutes, solution.insulationMinutes)) fields.push("insulation");
  return fields;
}

/** `key` is the catalogue's already-normalised text. Blank text proves nothing, so it never matches. */
function sameText(raw: string, key: string): boolean {
  const normalised = normaliseText(raw);
  return normalised !== "" && key !== "" && normalised === key;
}

function meets(required: number | null, offered: number | null): boolean {
  if (required === null) return true;
  if (!isNonNegativeFinite(required)) return false;
  return offered !== null && isNonNegativeFinite(offered) && offered >= required;
}
