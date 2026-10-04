import path from "node:path";
import { loadCatalogueFromCsv } from "@/adapters/catalogue-csv";
import { createMemoryActionsRepository } from "@/adapters/memory/actions-repository";
import { makeStubs } from "@/adapters/stub";
import { createSupabaseActionsRepository } from "@/adapters/supabase/actions-repository";
import type { Dependencies } from "@/application";
import { InternalError } from "@/ports";
import { readEnv } from "./env";

// Next bundles each route and page separately, so this module can load more than once per process.
// The built dependencies (and the memory store inside them) live on globalThis so pages and API routes share them.
const CACHE_KEY = Symbol.for("qantum.team-leader.dependencies");
const OVERRIDE_KEY = Symbol.for("qantum.team-leader.dependencies.override");
type CacheHolder = { [CACHE_KEY]?: Dependencies; [OVERRIDE_KEY]?: Dependencies | null };
const holder = globalThis as CacheHolder;

export function setDependenciesForTests(deps: Dependencies | null): void {
  holder[CACHE_KEY] = undefined;
  holder[OVERRIDE_KEY] = deps;
}

export function getDependencies(): Dependencies {
  const override = holder[OVERRIDE_KEY];
  if (override) return override;
  const cached = holder[CACHE_KEY];
  if (cached) return cached;
  const built = buildDependencies();
  holder[CACHE_KEY] = built;
  return built;
}

export function buildDependencies(): Dependencies {
  const env = readEnv();
  const production = process.env.NODE_ENV === "production";
  const store = env.actionsStore ?? (production ? "supabase" : "memory");
  if (production && store !== "supabase") throw new InternalError("store_forbidden");

  const now = (): Date => new Date();
  const newId = (): string => crypto.randomUUID();
  const stubs = makeStubs({ stock: stockMode() });
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

function stockMode(): "normal" | "down" | "empty" | "malformed" {
  if (process.env.NODE_ENV === "production") return "normal";
  const value = process.env.STUB_STOCK_MODE;
  if (value === "normal" || value === "down" || value === "empty" || value === "malformed") return value;
  return "normal";
}

function httpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
