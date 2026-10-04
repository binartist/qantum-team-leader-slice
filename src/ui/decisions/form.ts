import { GIVE_REASON, apiErrorMessage } from "../messages";
import type { DecisionResult } from "./api-client";

export interface SendOutcome {
  readonly announceSuccess: boolean;
  readonly refresh: boolean;
  readonly formError: string;
  readonly close: boolean;
}

export function noteProblem(value: string): string {
  if (value.trim().length > 500) return apiErrorMessage("payload_too_large");
  return "";
}

export function reasonProblem(value: string): string {
  if (value.trim().length < 1) return GIVE_REASON;
  return noteProblem(value);
}

export function escalateDestination(value: string): "warehouse" | "purchasing" {
  return value === "warehouse" ? "warehouse" : "purchasing";
}

export function dialogFieldError(code: string): string {
  return code === "validation_failed" ? apiErrorMessage(code) : "";
}

export function dialogFormError(code: string): string {
  if (code === "" || code === "validation_failed") return "";
  return apiErrorMessage(code);
}

export function sendOutcome(result: DecisionResult, dialogStillOpen: boolean): SendOutcome {
  if (!result.ok) {
    return { announceSuccess: false, refresh: false, formError: dialogStillOpen ? result.code : "", close: false };
  }
  return { announceSuccess: !result.replay, refresh: true, formError: "", close: dialogStillOpen };
}
