import { z } from "zod";
import nominationsFile from "../../../data/sample/nominations.json";
import sitesFile from "../../../data/sample/sites.json";
import solutionMaterialsFile from "../../../data/sample/solution-materials.json";
import stockFile from "../../../data/sample/stock.json";
import {
  IdSchema,
  NominationsFileSchema,
  SitesFileSchema,
  SolutionMaterialsFileSchema,
  StockFileSchema,
  UpstreamError,
  type Material,
  type NominatedPenetration,
  type NominationsPort,
  type Site,
  type SitesPort,
  type SolutionMaterialsPort,
  type StockPort,
} from "@/ports";

export type StubMode = "normal" | "down" | "empty" | "malformed";

export interface StubOptions {
  readonly sites?: StubMode;
  readonly nominations?: StubMode;
  readonly stock?: StubMode;
  readonly solutionMaterials?: StubMode;
}

export interface StubPorts {
  readonly sites: SitesPort;
  readonly nominations: NominationsPort;
  readonly stock: StockPort;
  readonly solutionMaterials: SolutionMaterialsPort;
}

const EMPTY_STOCK_AS_OF = "2026-10-03T08:00:00Z";

const MALFORMED = {
  sites: { sites: [{ id: "bad id", name: "Broken", reference: "X" }] },
  nominations: { bySite: { "site-a": [{ id: "pen-a-01" }] } },
  stock: { asOf: "2026-10-03T08:00:00Z", balances: [{ materialId: "MAT-SEALANT", location: "Warehouse", quantity: Number.POSITIVE_INFINITY }] },
  solutionMaterials: { materials: [{ id: "bad id", name: "Broken", unit: "each" }], items: [] },
} as const;

function parseUpstream<T>(schema: z.ZodType<T>, data: unknown, system: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new UpstreamError("upstream_invalid", system);
  return parsed.data;
}

function refuseIfDown(mode: StubMode, system: string): void {
  if (mode === "down") throw new UpstreamError("upstream_unavailable", system);
}

function sitesData(mode: StubMode): Site[] {
  refuseIfDown(mode, "sites");
  const source = mode === "malformed" ? MALFORMED.sites : mode === "empty" ? { sites: [] } : sitesFile;
  return parseUpstream(SitesFileSchema, source, "sites").sites;
}

function nominationsData(mode: StubMode): Record<string, NominatedPenetration[]> {
  refuseIfDown(mode, "nominations");
  const source = mode === "malformed" ? MALFORMED.nominations : mode === "empty" ? { bySite: {} } : nominationsFile;
  const parsed = parseUpstream(NominationsFileSchema, source, "nominations");
  const bySite: Record<string, NominatedPenetration[]> = {};
  for (const [siteId, penetrations] of Object.entries(parsed.bySite)) {
    if (!IdSchema.safeParse(siteId).success) throw new UpstreamError("upstream_invalid", "nominations");
    for (const penetration of penetrations) {
      if (penetration.siteId !== siteId) throw new UpstreamError("upstream_invalid", "nominations");
    }
    bySite[siteId] = penetrations;
  }
  return bySite;
}

function stockData(mode: StubMode): { asOf: string; balances: { materialId: string; location: string; quantity: number }[] } {
  refuseIfDown(mode, "stock");
  const source = mode === "malformed" ? MALFORMED.stock : mode === "empty" ? { asOf: EMPTY_STOCK_AS_OF, balances: [] } : stockFile;
  return parseUpstream(StockFileSchema, source, "stock");
}

function solutionMaterialsData(mode: StubMode): { materials: Material[]; items: { internalCode: string; materialId: string; quantityPerInstall: number }[] } {
  refuseIfDown(mode, "solution_materials");
  const source =
    mode === "malformed" ? MALFORMED.solutionMaterials : mode === "empty" ? { materials: [], items: [] } : solutionMaterialsFile;
  const parsed = parseUpstream(SolutionMaterialsFileSchema, source, "solution_materials");
  const known = new Set(parsed.materials.map((material) => material.id));
  for (const item of parsed.items) {
    if (!known.has(item.materialId)) throw new UpstreamError("upstream_invalid", "solution_materials");
  }
  return parsed;
}

export function makeStubs(options: StubOptions = {}): StubPorts {
  const sitesMode = options.sites ?? "normal";
  const nominationsMode = options.nominations ?? "normal";
  const stockMode = options.stock ?? "normal";
  const materialsMode = options.solutionMaterials ?? "normal";

  return {
    sites: {
      async listSites() {
        return sitesData(sitesMode);
      },
      async getSite(siteId) {
        const sites = sitesData(sitesMode);
        return sites.find((site) => site.id === siteId) ?? null;
      },
    },
    nominations: {
      async getNominations(siteId) {
        const bySite = nominationsData(nominationsMode);
        return bySite[siteId] ?? null;
      },
    },
    stock: {
      async getStock(materialIds) {
        const stock = stockData(stockMode);
        const wanted = new Set(materialIds);
        const balances = stock.balances.filter((balance) => wanted.has(balance.materialId));
        return parseUpstream(StockFileSchema, { asOf: stock.asOf, balances }, "stock");
      },
    },
    solutionMaterials: {
      async getSolutionMaterials(codes) {
        const file = solutionMaterialsData(materialsMode);
        const wanted = new Set(codes);
        const items = file.items.filter((item) => wanted.has(item.internalCode));
        const used = new Set(items.map((item) => item.materialId));
        const materials = file.materials.filter((material) => used.has(material.id));
        return parseUpstream(SolutionMaterialsFileSchema, { materials, items }, "solution_materials");
      },
    },
  };
}
