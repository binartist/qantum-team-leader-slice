import { listSites } from "@/application";
import { getDependencies } from "@/server/deps";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Promise<Response> {
  return handle(async () => json(await listSites(getDependencies())));
}
