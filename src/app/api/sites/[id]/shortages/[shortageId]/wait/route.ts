import { recordWait } from "@/application";
import { getDependencies } from "@/server/deps";
import { getCurrentUser } from "@/server/identity";
import { WaitBodySchema, handle, json, readPost, requireShortageId, requireSiteId } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string; shortageId: string }> }): Promise<Response> {
  return handle(async () => {
    const params = await context.params;
    const siteId = requireSiteId(params.id);
    const shortageId = requireShortageId(siteId, params.shortageId);
    const { idempotencyKey, body } = await readPost(request, WaitBodySchema);
    const result = await recordWait(getDependencies(), {
      siteId,
      shortageId,
      note: body.note ?? null,
      createdBy: getCurrentUser().id,
      idempotencyKey,
    });
    return json(result, result.created ? 201 : 200);
  });
}
