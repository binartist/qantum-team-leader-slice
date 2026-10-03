import { listCandidates } from "@/application";
import { getDependencies } from "@/server/deps";
import { handle, json, requirePenetrationId, requireSiteId } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(_request: Request, context: { params: Promise<{ id: string; pid: string }> }): Promise<Response> {
  return handle(async () => {
    const params = await context.params;
    const siteId = requireSiteId(params.id);
    const penetrationId = requirePenetrationId(params.pid);
    return json(await listCandidates(getDependencies(), siteId, penetrationId));
  });
}
