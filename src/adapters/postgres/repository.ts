import { z } from "zod";
import type { ShortageAction, SubstitutionProposal } from "@/domain";
import { UpstreamError, type ActionsRepository, type NewShortageAction, type NewSubstitutionProposal } from "@/ports";

const SYSTEM = "actions_store";

const UuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const TimestampSchema = z.string().min(1);

const ShortageActionRowSchema = z.object({
  id: UuidSchema,
  site_id: z.string().min(1),
  shortage_id: z.string().min(1),
  kind: z.enum(["wait", "escalate"]),
  escalate_to: z.enum(["purchasing", "warehouse"]).nullable(),
  note: z.string().max(500).nullable(),
  shortfall_qty_at_time: z.union([z.number(), z.string(), z.null()]),
  created_by: z.string().min(1),
  created_at: TimestampSchema,
  idempotency_key: z.string().min(1).max(128),
});

const SubstitutionProposalRowSchema = z.object({
  id: UuidSchema,
  site_id: z.string().min(1),
  penetration_id: z.string().min(1),
  from_internal_code: z.string().min(1),
  to_internal_code: z.string().min(1),
  reason: z.string().min(1).max(500),
  status: z.literal("proposed"),
  created_by: z.string().min(1),
  created_at: TimestampSchema,
  idempotency_key: z.string().min(1).max(128),
});

export interface ShortageActionInsert {
  readonly site_id: string;
  readonly shortage_id: string;
  readonly kind: "wait" | "escalate";
  readonly escalate_to: "purchasing" | "warehouse" | null;
  readonly note: string | null;
  readonly shortfall_qty_at_time: number | null;
  readonly created_by: string;
  readonly idempotency_key: string;
}

export interface SubstitutionProposalInsert {
  readonly site_id: string;
  readonly penetration_id: string;
  readonly from_internal_code: string;
  readonly to_internal_code: string;
  readonly reason: string;
  readonly status: "proposed";
  readonly created_by: string;
  readonly idempotency_key: string;
}

export interface StoreResult {
  readonly data: unknown;
  readonly error: { readonly code?: string } | null;
}

export interface ActionsStore {
  insertShortageAction(row: ShortageActionInsert): Promise<StoreResult>;
  selectShortageActionByKey(createdBy: string, idempotencyKey: string): Promise<StoreResult>;
  listShortageActions(siteId: string): Promise<StoreResult>;
  insertSubstitutionProposal(row: SubstitutionProposalInsert): Promise<StoreResult>;
  selectSubstitutionProposalByKey(createdBy: string, idempotencyKey: string): Promise<StoreResult>;
  listSubstitutionProposals(siteId: string): Promise<StoreResult>;
}

function readQuantity(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new UpstreamError("upstream_invalid", SYSTEM);
    return value;
  }
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new UpstreamError("upstream_invalid", SYSTEM);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new UpstreamError("upstream_invalid", SYSTEM);
  return parsed;
}

function readTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new UpstreamError("upstream_invalid", SYSTEM);
  return date.toISOString();
}

export function shortageActionToInsert(input: NewShortageAction): ShortageActionInsert {
  return {
    site_id: input.siteId,
    shortage_id: input.shortageId,
    kind: input.kind,
    escalate_to: input.escalateTo,
    note: input.note,
    shortfall_qty_at_time: input.shortfallQtyAtTime,
    created_by: input.createdBy,
    idempotency_key: input.idempotencyKey,
  };
}

export function substitutionProposalToInsert(input: NewSubstitutionProposal): SubstitutionProposalInsert {
  return {
    site_id: input.siteId,
    penetration_id: input.penetrationId,
    from_internal_code: input.fromInternalCode,
    to_internal_code: input.toInternalCode,
    reason: input.reason,
    status: "proposed",
    created_by: input.createdBy,
    idempotency_key: input.idempotencyKey,
  };
}

export function shortageActionFromRow(row: unknown): ShortageAction {
  const parsed = ShortageActionRowSchema.safeParse(row);
  if (!parsed.success) throw new UpstreamError("upstream_invalid", SYSTEM);
  const escalate = parsed.data.kind === "escalate";
  if (escalate !== (parsed.data.escalate_to !== null)) throw new UpstreamError("upstream_invalid", SYSTEM);
  return {
    id: parsed.data.id,
    siteId: parsed.data.site_id,
    shortageId: parsed.data.shortage_id,
    kind: parsed.data.kind,
    escalateTo: parsed.data.escalate_to,
    note: parsed.data.note,
    shortfallQtyAtTime: readQuantity(parsed.data.shortfall_qty_at_time),
    createdBy: parsed.data.created_by,
    createdAt: readTimestamp(parsed.data.created_at),
  };
}

export function substitutionProposalFromRow(row: unknown): SubstitutionProposal {
  const parsed = SubstitutionProposalRowSchema.safeParse(row);
  if (!parsed.success) throw new UpstreamError("upstream_invalid", SYSTEM);
  if (parsed.data.from_internal_code === parsed.data.to_internal_code) throw new UpstreamError("upstream_invalid", SYSTEM);
  return {
    id: parsed.data.id,
    siteId: parsed.data.site_id,
    penetrationId: parsed.data.penetration_id,
    fromInternalCode: parsed.data.from_internal_code,
    toInternalCode: parsed.data.to_internal_code,
    reason: parsed.data.reason,
    status: "proposed",
    createdBy: parsed.data.created_by,
    createdAt: readTimestamp(parsed.data.created_at),
  };
}

function byNewest<T extends { createdAt: string }>(left: T, right: T): number {
  const leftMs = Date.parse(left.createdAt);
  const rightMs = Date.parse(right.createdAt);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs) || leftMs === rightMs) return 0;
  return leftMs > rightMs ? -1 : 1;
}

function rowsOf(result: StoreResult): unknown[] {
  if (result.error || !Array.isArray(result.data)) throw new UpstreamError("upstream_unavailable", SYSTEM);
  return result.data;
}

function readByKey<T>(result: StoreResult, fromRow: (row: unknown) => T): T | null {
  if (result.error || Array.isArray(result.data)) throw new UpstreamError("upstream_unavailable", SYSTEM);
  if (result.data == null) return null;
  return fromRow(result.data);
}

async function writeOne<T>(
  inserted: StoreResult,
  readExisting: () => Promise<StoreResult>,
  fromRow: (row: unknown) => T,
): Promise<{ record: T; created: boolean }> {
  if (!inserted.error) return { record: fromRow(inserted.data), created: true };
  if (inserted.error.code !== "23505") throw new UpstreamError("upstream_unavailable", SYSTEM);
  const existing = await readExisting();
  if (existing.error || existing.data == null || Array.isArray(existing.data)) throw new UpstreamError("upstream_unavailable", SYSTEM);
  return { record: fromRow(existing.data), created: false };
}

export function createActionsRepository(store: ActionsStore): ActionsRepository {
  return {
    async appendShortageAction(input) {
      return writeOne(await store.insertShortageAction(shortageActionToInsert(input)), () => store.selectShortageActionByKey(input.createdBy, input.idempotencyKey), shortageActionFromRow);
    },
    async appendSubstitutionProposal(input) {
      return writeOne(
        await store.insertSubstitutionProposal(substitutionProposalToInsert(input)),
        () => store.selectSubstitutionProposalByKey(input.createdBy, input.idempotencyKey),
        substitutionProposalFromRow,
      );
    },
    async findShortageActionByKey(createdBy, idempotencyKey) {
      return readByKey(await store.selectShortageActionByKey(createdBy, idempotencyKey), shortageActionFromRow);
    },
    async findSubstitutionProposalByKey(createdBy, idempotencyKey) {
      return readByKey(await store.selectSubstitutionProposalByKey(createdBy, idempotencyKey), substitutionProposalFromRow);
    },
    async listShortageActions(siteId) {
      return rowsOf(await store.listShortageActions(siteId))
        .map((row) => shortageActionFromRow(row))
        .sort(byNewest);
    },
    async listSubstitutionProposals(siteId) {
      return rowsOf(await store.listSubstitutionProposals(siteId))
        .map((row) => substitutionProposalFromRow(row))
        .sort(byNewest);
    },
  };
}
