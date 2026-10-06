export type Tone = "success" | "danger" | "warning" | "neutral" | "info" | "escalation";
export type IconName = "check" | "stop" | "dashed-circle" | "warning" | "clock" | "arrow-up";

export interface StatusView {
  readonly label: string;
  readonly tone: Tone;
  readonly icon: IconName;
}

export type CrewChip = "clear" | "blocked" | "nothing_planned" | "unavailable";
export type ShortageChip = "open" | "waiting" | "escalated";
export type BlockerCode = "unknown_solution_code" | "solution_mismatch" | "no_material_mapping" | "invalid_quantity";
export type FitFieldCode = "orientation" | "substrate" | "serviceType" | "serviceSize" | "integrity" | "insulation";
export type CandidateChip = "ok" | "substrate_incomplete" | "nominated_code_unknown";
export type AvailabilityChip = "in_stock" | "short" | "unknown" | "no_material_mapping" | "invalid_quantity";
export type ActionChip = "current" | "earlier" | "resolved";

export function crewStatus(status: CrewChip): StatusView {
  if (status === "clear") return { label: "Crew can go", tone: "success", icon: "check" };
  if (status === "blocked") return { label: "Blocked", tone: "danger", icon: "stop" };
  if (status === "nothing_planned") return { label: "Nothing planned", tone: "neutral", icon: "dashed-circle" };
  return { label: "Can't check", tone: "warning", icon: "warning" };
}

const UNKNOWN: StatusView = { label: "Unknown", tone: "neutral", icon: "dashed-circle" };

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function blockedChipLabel(shortages: number, problems: number): string {
  const shortageText = countLabel(shortages, "shortage", "shortages");
  const problemText = countLabel(problems, "data problem", "data problems");
  if (shortages > 0 && problems > 0) return `Blocked · ${shortageText}, ${problemText}`;
  if (problems > 0) return `Blocked · ${problemText}`;
  if (shortages > 0) return `Blocked · ${shortageText}`;
  return "Blocked";
}

export function siteChip(status: string, shortageCount: number, dataProblemCount: number): StatusView {
  if (status === "blocked") return { label: blockedChipLabel(shortageCount, dataProblemCount), tone: "danger", icon: "stop" };
  if (status === "clear" || status === "nothing_planned" || status === "unavailable") return crewStatus(status);
  return crewStatus("unavailable");
}

const usableMinutes = (value: number) => Number.isFinite(value) && value >= 0;

// Same rule as the domain's fit check: a negative or non-finite number never meets anything.
function minuteMeets(candidate: number | null, required: number | null): boolean {
  if (required === null) return true;
  if (candidate === null || !usableMinutes(candidate) || !usableMinutes(required)) return false;
  return candidate >= required;
}

export function ratingComparison(
  candidateIntegrity: number | null,
  candidateInsulation: number | null,
  requiredIntegrity: number | null,
  requiredInsulation: number | null,
): StatusView {
  const meets = minuteMeets(candidateIntegrity, requiredIntegrity) && minuteMeets(candidateInsulation, requiredInsulation);
  if (meets) return { label: "Meets the required rating", tone: "success", icon: "check" };
  return { label: "Below the required rating", tone: "warning", icon: "warning" };
}

export function shortageState(state: string): StatusView {
  switch (state) {
    case "open":
      return { label: "No decision yet", tone: "neutral", icon: "dashed-circle" };
    case "waiting":
      return { label: "Waiting", tone: "info", icon: "clock" };
    case "escalated":
      return { label: "Escalated", tone: "escalation", icon: "arrow-up" };
    default:
      return UNKNOWN;
  }
}

/** The icon and tone of the state a decision creates, for its button and its log entry. */
export function decisionMark(kind: "wait" | "escalate"): { tone: Tone; icon: IconName } {
  const view = shortageState(kind === "wait" ? "waiting" : "escalated");
  return { tone: view.tone, icon: view.icon };
}

export function earlierDecision(): StatusView {
  return { label: "Earlier decision, shortfall has grown", tone: "warning", icon: "warning" };
}

export function hasEarlierDecision(actions: readonly { readonly current: boolean }[]): boolean {
  return actions.some((action) => !action.current);
}

const FIT_FIELD_LABELS: Readonly<Record<FitFieldCode, string>> = {
  orientation: "orientation",
  substrate: "substrate",
  serviceType: "service type",
  serviceSize: "size",
  integrity: "integrity",
  insulation: "insulation",
};

export function fitFieldLabel(field: FitFieldCode): string {
  return FIT_FIELD_LABELS[field];
}

/** A comparison cell whose solution value does not fit the penetration (AC 36). */
export function doesNotFit(solutionValue: string): StatusView {
  return { label: `${solutionValue}, doesn't fit`, tone: "danger", icon: "stop" };
}

export function blockerReason(reason: BlockerCode, code: string, mismatches: readonly FitFieldCode[] = []): StatusView {
  if (reason === "unknown_solution_code") {
    return { label: `Solution code ${code} isn't in the catalogue`, tone: "danger", icon: "warning" };
  }
  if (reason === "solution_mismatch") {
    const fields = mismatches.map(fitFieldLabel).join(", ");
    const label = fields ? `Solution ${code} doesn't fit this penetration: ${fields}` : `Solution ${code} doesn't fit this penetration`;
    return { label, tone: "danger", icon: "warning" };
  }
  if (reason === "no_material_mapping") {
    return { label: `No materials recorded for solution ${code}`, tone: "danger", icon: "warning" };
  }
  return { label: `A material quantity is invalid for solution ${code}`, tone: "danger", icon: "warning" };
}

export function candidateStatus(status: CandidateChip): StatusView {
  if (status === "substrate_incomplete") {
    return {
      label: "The catalogue entry for this substrate is incomplete, so we can't suggest substitutes.",
      tone: "warning",
      icon: "warning",
    };
  }
  if (status === "nominated_code_unknown") {
    return {
      label: "The nominated solution isn't in the catalogue, so we can't suggest substitutes.",
      tone: "warning",
      icon: "warning",
    };
  }
  return {
    label: "No catalogue match for this penetration. Escalate instead.",
    tone: "neutral",
    icon: "dashed-circle",
  };
}

export function emptyCatalogueLabel(hasRelated: boolean): string {
  if (hasRelated) return "No catalogue match for this penetration. Escalate instead.";
  return "No catalogue match for this penetration.";
}

export function availabilityStatus(overall: AvailabilityChip): StatusView {
  if (overall === "in_stock") return { label: "Materials in stock", tone: "success", icon: "check" };
  if (overall === "short") return { label: "Uses a material this site is short of.", tone: "danger", icon: "stop" };
  if (overall === "unknown") return { label: "No stock record for one of its materials.", tone: "warning", icon: "warning" };
  if (overall === "no_material_mapping") {
    return { label: "We can't tell if its materials are in stock.", tone: "warning", icon: "warning" };
  }
  return { label: "Its material quantities look invalid.", tone: "danger", icon: "warning" };
}

export function actionStatus(status: string): StatusView {
  switch (status) {
    case "current":
      return { label: "Still applies", tone: "neutral", icon: "dashed-circle" };
    case "earlier":
      return { label: "Shortfall has grown since", tone: "warning", icon: "warning" };
    case "resolved":
      return { label: "Shortage resolved", tone: "success", icon: "check" };
    default:
      return UNKNOWN;
  }
}
