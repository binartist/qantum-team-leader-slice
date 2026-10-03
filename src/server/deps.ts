import path from "node:path";
import { loadCatalogueFromCsv } from "@/adapters/catalogue-csv";
import { createMemoryActionsRepository } from "@/adapters/memory/actions-repository";
import { makeStubs } from "@/adapters/stub";
import { createSupabaseActionsRepository } from "@/adapters/supabase/actions-repository";
import type { Dependencies } from "@/application";
import { InternalError } from "@/ports";
import { readEnv } from "./env";

let override: Dependencies | null = null;
let usingOverride = false;
let cached: Dependencies | null = null;

export function setDependenciesForTests(deps: Dependencies | null): void {
  cached = null;
  if (deps === null) {
    usingOverride = false;
    override = null;
    return;
  }
  usingOverride = true;
  override = deps;
}

export function getDependencies(): Dependencies {
  if (usingOverride && override) return override;
  if (cached) return cached;
  cached = buildDependencies();
  return cached;
}

export function buildDependencies(): Dependencies {
  const env = readEnv();
  const production = process.env.NODE_ENV === "production";
  const store = env.actionsStore ?? (production ? "supabase" : "memory");
  if (production && store !== "supabase") throw new InternalError("store_forbidden");

  const now = (): Date => new Date();
  const newId = (): string => crypto.randomUUID();
  const stubs = makeStubs();
  const catalogue = loadCatalogueFromCsv(path.join(process.cwd(), "data", "solutions-excerpt.csv"));

  let actions: Dependencies["actions"];
  if (store === "supabase") {
    if (!env.supabaseUrl || !env.supabaseServiceKey) throw new InternalError("supabase_unconfigured");
    if (production && !httpsUrl(env.supabaseUrl)) throw new InternalError("supabase_url_insecure");
    actions = createSupabaseActionsRepository({ url: env.supabaseUrl, serviceKey: env.supabaseServiceKey });
  } else {
    actions = createMemoryActionsRepository({ now, newId });
  }

  return {
    sites: stubs.sites,
    nominations: stubs.nominations,
    stock: stubs.stock,
    solutionMaterials: stubs.solutionMaterials,
    catalogue,
    actions,
    now,
  };
}

function httpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
