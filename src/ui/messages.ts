import { crewStatus, type StatusView } from "./status";

export const CREW_STAYS = "This does not release the crew.";
export const RECORDS_ONLY = "This records your decision here. Nobody is notified automatically yet.";
export const STOCK_STALE = "These stock figures are more than a day old. Check with the warehouse before relying on them.";
export const SUBSTITUTES = "Substitutes";
export const GIVE_REASON = "Give a reason.";
export const MANAGER_CHECK = "A manager has to verify this catalogue match.";

export const EMPTY = {
  sites: "No sites to show.",
  actions: "Nothing recorded for this site yet.",
  penetrations: "No penetrations planned for this site.",
} as const;

export const PENETRATION_FILTER = {
  showAll: "Show all",
  unknown: "That material is not a shortage on this site. Showing all penetrations.",
} as const;

/** The drawer side menu (AC 37). */
export const NAV = {
  open: "Open menu",
  close: "Close menu",
  title: "Team leader",
  label: "Main",
  sites: "Sites",
  materials: "Materials",
  actions: "Actions log",
  about: "About this demo",
} as const;

export const THEME = {
  legend: "Theme",
  system: "System",
  light: "Light",
  dark: "Dark",
} as const;

export const ACTIONS_LOG = {
  unavailable: "We can't load the actions log right now. Try again shortly.",
  siteUnavailable: "We can't check this site's actions right now.",
  empty: "No sites to show.",
} as const;

export const PENETRATION_LOG = {
  unavailable: "We can't load this penetration's actions right now. Try again shortly.",
  empty: "Nothing recorded for this penetration yet.",
} as const;

/** How widely a material decision on one penetration still applies. */
export function appliesToPenetrations(count: number): string {
  return `Applies to all ${count} penetrations at this site`;
}

export const MATERIALS = {
  title: "Materials",
  detailTitle: "Material",
  empty: "No materials planned at any site.",
  emptyChecked: "No materials planned at the sites that could be checked.",
  unavailable: "Can't check stock right now. Don't assume any material is in stock. Try again.",
  notShortAnywhere: "Not short at any site",
  siteUnavailable: "Can't check this site right now. Don't assume it has enough.",
} as const;

export const NO_FILTER_MATCH = "No penetrations match these filters.";

export function filterLine(materialName: string, shown: number, total: number): string {
  return `Using ${materialName} · ${shown} of ${total}`;
}

export const FILTERS = {
  label: "Filter penetrations",
  shortages: "Shortages",
  dataProblems: "Data problems",
  acted: "Acted",
} as const;

export const SITES_UNAVAILABLE = "Can't check the sites right now. Don't assume any site is clear. Try again.";

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

/** Banner for a clear site, or for nothing planned. A blocked site has no banner: the rows say why (AC 34). */
export function readinessBanner(status: string): StatusView {
  switch (status) {
    case "blocked":
      return { label: "Blocked: hold the crew.", tone: "danger", icon: "stop" };
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
