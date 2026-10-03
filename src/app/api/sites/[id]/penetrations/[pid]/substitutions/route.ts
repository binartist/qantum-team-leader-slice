import { proposeSubstitution } from "@/application";
import { getDependencies } from "@/server/deps";
import { getCurrentUser } from "@/server/identity";
import { SubstitutionBodySchema, handle, json, readPost, requirePenetrationId, requireSiteId } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string; pid: string }> }): Promise<Response> {
  return handle(async () => {
    const params = await context.params;
    const siteId = requireSiteId(params.id);
    const penetrationId = requirePenetrationId(params.pid);
    const { idempotencyKey, body } = await readPost(request, SubstitutionBodySchema);
    const result = await proposeSubstitution(getDependencies(), {
      siteId,
      penetrationId,
      fromInternalCode: body.fromInternalCode,
      toInternalCode: body.toInternalCode,
      reason: body.reason,
      createdBy: getCurrentUser().id,
      idempotencyKey,
    });
    return json(result, result.created ? 201 : 200);
  });
}
