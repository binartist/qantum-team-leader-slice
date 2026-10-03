import { listActions } from "@/application";
import { getDependencies } from "@/server/deps";
import { handle, json, requireSiteId } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return json(await listActions(getDependencies(), requireSiteId(id)));
  });
}
