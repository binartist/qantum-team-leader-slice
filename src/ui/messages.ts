import { crewStatus, type StatusView } from "./status";

export const CREW_STAYS = "This does not release the crew.";
export const RECORDS_ONLY = "This records your decision here. Nobody is notified automatically yet.";
export const OPEN_PENETRATION = "Open a penetration to see possible substitutes.";
export const STOCK_STALE = "These stock figures are more than a day old. Check with the warehouse before relying on them.";
export const SUBSTITUTES = "Substitutes";
export const GIVE_REASON = "Give a reason.";
export const MANAGER_CHECK = "A manager has to verify this catalogue match.";

export const EMPTY = {
  sites: "No sites to show.",
  actions: "Nothing recorded for this site yet.",
} as const;

export const SITES_UNAVAILABLE = "Can't check the sites right now. Don't assume any site is clear. Try again.";
export const DEMO_BANNER = "Demo: sample data, no login";

export const BUTTONS = {
  wait: "Wait",
  escalate: "Escalate",
  propose: "Propose this",
  sendEscalation: "Send escalation",
  sendWait: "Send wait",
  sendProposal: "Send proposal",
  cancel: "Cancel",
  sending: "Sending…",
  tryAgain: "Try again",
  actionsLog: "Actions log",
} as const;

export const ANNOUNCE = {
  escalation: "Escalation recorded",
  wait: "Wait recorded",
  proposal: "Proposal recorded",
  replay: "Already recorded",
} as const;

const FALLBACK = "Something went wrong. Nothing was recorded.";

const ERRORS: Readonly<Record<string, string>> = {
  validation_failed: "Check the highlighted fields.",
  payload_too_large: "That's too long. Shorten it.",
  shortage_not_found: "That shortage no longer exists. Refresh to see the latest.",
  stale_nomination: "This penetration's nomination has changed. Refresh and try again.",
  not_a_candidate: "That solution is no longer a candidate. Refresh and try again.",
  idempotency_key_reused: "Something went wrong sending that. Close this and try again.",
  upstream_unavailable: "A system we depend on isn't available. Nothing was recorded. Try again.",
  upstream_invalid: "A system we depend on isn't available. Nothing was recorded. Try again.",
  transport_failed: "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice.",
};

const UNAVAILABLE_BANNER: StatusView = {
  label: "Can't check this site right now. Don't assume it's clear. Try again.",
  tone: "warning",
  icon: "warning",
};

export function apiErrorMessage(code: string): string {
  return ERRORS[code] ?? FALLBACK;
}

export function readinessBanner(status: string, shortages: number, blockers: number): StatusView {
  switch (status) {
    case "blocked": {
      if (shortages === 0 && blockers > 0) {
        const problems = `${blockers} ${blockers === 1 ? "data problem" : "data problems"}`;
        return { label: `Blocked: ${problems}. Hold the crew until they are sorted.`, tone: "danger", icon: "cross" };
      }
      const shortageText = `${shortages} ${shortages === 1 ? "shortage" : "shortages"}`;
      const problem = blockers > 0 ? ` (and ${blockers} ${blockers === 1 ? "data problem" : "data problems"})` : "";
      // Stock arriving does not fix a data problem, so the next step names both.
      const nextStep = blockers > 0 ? "Hold the crew until stock arrives and the data problems are sorted." : "Hold the crew until stock arrives.";
      return {
        label: `Blocked: ${shortageText}${problem}. ${nextStep}`,
        tone: "danger",
        icon: "cross",
      };
    }
    case "nothing_planned":
      return { label: "Nothing planned for this site", tone: "neutral", icon: "dashed-circle" };
    case "clear":
      return crewStatus("clear");
    case "unavailable":
      return UNAVAILABLE_BANNER;
    default:
      return UNAVAILABLE_BANNER;
  }
}
