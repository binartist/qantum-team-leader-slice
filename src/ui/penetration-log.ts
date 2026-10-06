import { actionSentence, actionTarget, materialPagePath } from "./format";
import { appliesToPenetrations } from "./messages";

export interface PenetrationLogAction {
  readonly id: string;
  readonly shortageId: string;
  readonly kind: "wait" | "escalate";
  readonly escalateTo: "purchasing" | "warehouse" | null;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly status: "current" | "earlier" | "resolved";
}

export interface PenetrationLogProposal {
  readonly id: string;
  readonly penetrationId: string;
  readonly fromInternalCode: string;
  readonly toInternalCode: string;
  readonly reason: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface PenetrationLogSource {
  readonly actions: readonly PenetrationLogAction[];
  readonly proposals: readonly PenetrationLogProposal[];
  readonly materials: Readonly<Record<string, { readonly name: string }>>;
  readonly penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string }>>;
}

export type PenetrationLogEntry =
  | {
      readonly kind: "action";
      readonly id: string;
      readonly createdAt: string;
      readonly sentence: string;
      readonly createdBy: string;
      readonly note: string | null;
      readonly status: PenetrationLogAction["status"];
      readonly decision: "wait" | "escalate";
      /** A material that is still open. A resolved material, and every data problem, has nowhere else to go. */
      readonly href: string | null;
      /** The material, when this decision is about one. Null for a data problem. */
      readonly materialId: string | null;
    }
  | {
      readonly kind: "proposal";
      readonly id: string;
      readonly createdAt: string;
      readonly fromCode: string;
      readonly toCode: string;
      readonly place: string | undefined;
      readonly reason: string;
      readonly createdBy: string;
    };

function byNewest(left: { readonly createdAt: string }, right: { readonly createdAt: string }): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs) || leftMs === rightMs) return 0;
  return leftMs > rightMs ? -1 : 1;
}

function materialIdOf(siteId: string, shortageId: string, materialIds: readonly string[]): string | null {
  const prefix = `${siteId}:`;
  if (!shortageId.startsWith(prefix)) return null;
  const rest = shortageId.slice(prefix.length);
  if (rest.startsWith("blocker.")) return null;
  return materialIds.includes(rest) ? rest : null;
}

/**
 * The muted line under a material decision. Omitted for a data problem, and when that material is no longer
 * a shortage in readiness (it was resolved, or the count would not be a real number of penetrations).
 */
export function materialDecisionScope(
  materialId: string | null,
  shortages: readonly { readonly materialId: string; readonly penetrationIds: readonly string[] }[],
): string | null {
  if (materialId === null) return null;
  const shortage = shortages.find((item) => item.materialId === materialId);
  if (!shortage || shortage.penetrationIds.length < 1) return null;
  return appliesToPenetrations(shortage.penetrationIds.length);
}

function actionHref(siteId: string, penetrationId: string, action: PenetrationLogAction, materialId: string | null): string | null {
  if (materialId === null || action.status === "resolved") return null;
  return materialPagePath(materialId, { siteId, penetrationId });
}

/**
 * This penetration's decisions and proposals, newest first. A shortage action is included when it is about
 * a material of the nominated solution, or about this penetration's own data problem. A resolved decision
 * stays. An unreadable date does not reorder the list.
 */
export function penetrationLog(
  listed: PenetrationLogSource,
  siteId: string,
  penetrationId: string,
  materialIds: readonly string[],
): PenetrationLogEntry[] {
  const blockerId = `${siteId}:blocker.${penetrationId}`;
  const actions: PenetrationLogEntry[] = [];
  for (const action of listed.actions) {
    const materialId = action.shortageId === blockerId ? null : materialIdOf(siteId, action.shortageId, materialIds);
    if (action.shortageId !== blockerId && materialId === null) continue;
    actions.push({
      kind: "action",
      id: action.id,
      createdAt: action.createdAt,
      sentence: actionSentence(action.kind, action.escalateTo, actionTarget(siteId, action.shortageId, listed.materials, listed.penetrations)),
      createdBy: action.createdBy,
      note: action.note,
      status: action.status,
      decision: action.kind,
      href: actionHref(siteId, penetrationId, action, materialId),
      materialId,
    });
  }
  const proposals: PenetrationLogEntry[] = [];
  for (const proposal of listed.proposals) {
    if (proposal.penetrationId !== penetrationId) continue;
    const place = listed.penetrations[proposal.penetrationId];
    proposals.push({
      kind: "proposal",
      id: proposal.id,
      createdAt: proposal.createdAt,
      fromCode: proposal.fromInternalCode,
      toCode: proposal.toInternalCode,
      place: place ? `${place.floor}, ${place.location}` : undefined,
      reason: proposal.reason,
      createdBy: proposal.createdBy,
    });
  }
  return [...actions, ...proposals].sort(byNewest);
}
