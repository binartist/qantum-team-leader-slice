import { actionSentence, actionTarget } from "./format";
import { atSite } from "./messages";

export interface MaterialLogAction {
  readonly id: string;
  readonly shortageId: string;
  readonly kind: "wait" | "escalate";
  readonly escalateTo: "purchasing" | "warehouse" | null;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly status: "current" | "earlier" | "resolved";
}

/** One wait or escalation on this material's shortage at one site. Proposals are not listed. */
export interface MaterialLogEntry {
  readonly id: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly createdAt: string;
  readonly sentence: string;
  readonly createdBy: string;
  readonly note: string | null;
  readonly status: MaterialLogAction["status"];
  readonly decision: "wait" | "escalate";
  /** "At {site name}". */
  readonly at: string;
}

export type MaterialLogSection =
  | {
      readonly status: "ready";
      readonly siteId: string;
      readonly siteName: string;
      readonly listed: {
        readonly actions: readonly MaterialLogAction[];
        readonly materials: Readonly<Record<string, { readonly name: string }>>;
        readonly penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string }>>;
      };
    }
  | { readonly status: "unavailable"; readonly siteId: string; readonly siteName: string };

export interface MaterialLogResult {
  readonly entries: readonly MaterialLogEntry[];
  /** Site names whose log could not be read, in the order the sections were given. */
  readonly uncheckedSites: readonly string[];
}

function byNewest(left: { readonly createdAt: string }, right: { readonly createdAt: string }): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs) || leftMs === rightMs) return 0;
  return leftMs > rightMs ? -1 : 1;
}

/** Warning when some sites' logs could not be read. One site and several are worded differently. */
export function uncheckedMaterialActions(count: number): string {
  if (count === 1) return "We can't check 1 site's actions right now. Its decisions are not listed.";
  return `We can't check ${count} sites' actions right now. Their decisions are not listed.`;
}

/**
 * Every wait and escalation on this material's shortage (`siteId:materialId`), newest first.
 * A blocker, another material, or a proposal is not included. An unreadable date keeps the original order.
 * An unavailable section is named in `uncheckedSites` and contributes no entries.
 */
export function materialLog(sections: readonly MaterialLogSection[], materialId: string): MaterialLogResult {
  const entries: MaterialLogEntry[] = [];
  const uncheckedSites: string[] = [];
  for (const section of sections) {
    if (section.status === "unavailable") {
      uncheckedSites.push(section.siteName);
      continue;
    }
    const shortageId = `${section.siteId}:${materialId}`;
    for (const action of section.listed.actions) {
      if (action.shortageId !== shortageId) continue;
      entries.push({
        id: action.id,
        siteId: section.siteId,
        siteName: section.siteName,
        createdAt: action.createdAt,
        sentence: actionSentence(
          action.kind,
          action.escalateTo,
          actionTarget(section.siteId, action.shortageId, section.listed.materials, section.listed.penetrations),
        ),
        createdBy: action.createdBy,
        note: action.note,
        status: action.status,
        decision: action.kind,
        at: atSite(section.siteName),
      });
    }
  }
  entries.sort(byNewest);
  return { entries, uncheckedSites };
}
