export type Tone = "success" | "danger" | "warning" | "neutral";
export type IconName = "check" | "cross" | "dashed-circle" | "warning";

export interface StatusView {
  readonly label: string;
  readonly tone: Tone;
  readonly icon: IconName;
}

export type CrewChip = "clear" | "blocked" | "nothing_planned" | "unavailable";
export type ShortageChip = "open" | "waiting" | "escalated";
export type BlockerCode = "unknown_solution_code" | "no_material_mapping" | "invalid_quantity";
export type CandidateChip = "ok" | "substrate_incomplete" | "nominated_code_unknown";
export type AvailabilityChip = "in_stock" | "short" | "unknown" | "no_material_mapping" | "invalid_quantity";
export type ActionChip = "current" | "earlier" | "resolved";

export function crewStatus(status: CrewChip): StatusView {
  if (status === "clear") return { label: "Crew can go", tone: "success", icon: "check" };
  if (status === "blocked") return { label: "Blocked", tone: "danger", icon: "cross" };
  if (status === "nothing_planned") return { label: "Nothing planned", tone: "neutral", icon: "dashed-circle" };
  return { label: "Can't check", tone: "warning", icon: "warning" };
}

const UNKNOWN: StatusView = { label: "Unknown", tone: "neutral", icon: "dashed-circle" };

export function shortageState(state: string): StatusView {
  switch (state) {
    case "open":
      return { label: "Open", tone: "neutral", icon: "dashed-circle" };
    case "waiting":
      return { label: "Waiting", tone: "warning", icon: "warning" };
    case "escalated":
      return { label: "Escalated", tone: "warning", icon: "warning" };
    default:
      return UNKNOWN;
  }
}

export function earlierDecision(): StatusView {
  return { label: "Earlier decision, shortfall has grown", tone: "warning", icon: "warning" };
}

export function hasEarlierDecision(actions: readonly { readonly current: boolean }[]): boolean {
  return actions.some((action) => !action.current);
}

export function blockerReason(reason: BlockerCode, code: string): StatusView {
  if (reason === "unknown_solution_code") {
    return { label: `Solution code ${code} isn't in the catalogue`, tone: "danger", icon: "warning" };
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
  if (overall === "short") return { label: "Some of its materials are short.", tone: "danger", icon: "cross" };
  if (overall === "unknown") return { label: "No stock record for one of its materials.", tone: "warning", icon: "warning" };
  if (overall === "no_material_mapping") {
    return { label: "We can't tell if its materials are in stock.", tone: "warning", icon: "warning" };
  }
  return { label: "Its material quantities look invalid.", tone: "danger", icon: "warning" };
}

export function actionStatus(status: string): StatusView {
  switch (status) {
    case "current":
      return { label: "Current", tone: "success", icon: "check" };
    case "earlier":
      return earlierDecision();
    case "resolved":
      return { label: "Resolved", tone: "neutral", icon: "check" };
    default:
      return UNKNOWN;
  }
}
