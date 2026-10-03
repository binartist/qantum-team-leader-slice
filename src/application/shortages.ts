import type { ActionKind, EscalateTo, ShortageAction } from "@/domain";
import { IdempotencyKeyReusedError, ShortageNotFoundError, ValidationFailedError, WaitNotAllowedError } from "@/ports";
import { getSiteReadiness } from "./readiness";
import type { Dependencies } from "./types";

export interface RecordWaitInput {
  readonly siteId: string;
  readonly shortageId: string;
  readonly note: string | null;
  readonly createdBy: string;
  readonly idempotencyKey: string;
}

export interface RecordEscalationInput {
  readonly siteId: string;
  readonly shortageId: string;
  readonly escalateTo: EscalateTo;
  readonly note: string | null;
  readonly createdBy: string;
  readonly idempotencyKey: string;
}

function noteOrNull(note: string | null): string | null {
  if (note === null) return null;
  const trimmed = note.trim();
  if (trimmed.length > 500) throw new ValidationFailedError(["note"]);
  return trimmed.length === 0 ? null : trimmed;
}

async function replayShortageAction(
  deps: Dependencies,
  input: { readonly siteId: string; readonly shortageId: string; readonly createdBy: string; readonly idempotencyKey: string },
  kind: ActionKind,
): Promise<ShortageAction | null> {
  const existing = await deps.actions.findShortageActionByKey(input.createdBy, input.idempotencyKey);
  if (!existing) return null;
  if (existing.siteId === input.siteId && existing.shortageId === input.shortageId && existing.kind === kind) return existing;
  throw new IdempotencyKeyReusedError();
}

export async function recordWait(deps: Dependencies, input: RecordWaitInput): Promise<{ record: ShortageAction; created: boolean }> {
  const note = noteOrNull(input.note);
  const replay = await replayShortageAction(deps, input, "wait");
  if (replay) return { record: replay, created: false };
  const readiness = await getSiteReadiness(deps, input.siteId);
  const shortage = readiness.shortages.find((item) => item.id === input.shortageId);
  const blocker = readiness.blockers.find((item) => item.id === input.shortageId);
  if (!shortage && blocker) throw new WaitNotAllowedError();
  if (!shortage) throw new ShortageNotFoundError();
  return deps.actions.appendShortageAction({
    siteId: input.siteId,
    shortageId: shortage.id,
    kind: "wait",
    escalateTo: null,
    note,
    shortfallQtyAtTime: shortage.shortfallQty,
    createdBy: input.createdBy,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function recordEscalation(
  deps: Dependencies,
  input: RecordEscalationInput,
): Promise<{ record: ShortageAction; created: boolean }> {
  const note = noteOrNull(input.note);
  const replay = await replayShortageAction(deps, input, "escalate");
  if (replay) return { record: replay, created: false };
  const readiness = await getSiteReadiness(deps, input.siteId);
  const shortage = readiness.shortages.find((item) => item.id === input.shortageId);
  const blocker = readiness.blockers.find((item) => item.id === input.shortageId);
  if (!shortage && !blocker) throw new ShortageNotFoundError();
  return deps.actions.appendShortageAction({
    siteId: input.siteId,
    shortageId: input.shortageId,
    kind: "escalate",
    escalateTo: input.escalateTo,
    note,
    shortfallQtyAtTime: shortage ? shortage.shortfallQty : null,
    createdBy: input.createdBy,
    idempotencyKey: input.idempotencyKey,
  });
}
