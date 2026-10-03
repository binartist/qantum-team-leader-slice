import { z } from "zod";

/** Ids cannot contain `:`, because a shortage id is `siteId:materialId`. */
export const IdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/);

const finiteNumber = z.number().refine((value) => Number.isFinite(value));

export const SiteSchema = z.object({
  id: IdSchema,
  name: z.string(),
  reference: z.string(),
  address: z.string().optional(),
});

export const SitesFileSchema = z.object({
  sites: z.array(SiteSchema),
});

export const NominatedPenetrationSchema = z.object({
  id: IdSchema,
  siteId: IdSchema,
  floor: z.string(),
  location: z.string(),
  orientation: z.enum(["Wall", "Floor", "Ceiling"]),
  substrateDetail: z.string(),
  serviceType: z.string(),
  serviceSize: z.string(),
  requiredIntegrityMinutes: finiteNumber.nullable(),
  requiredInsulationMinutes: finiteNumber.nullable(),
  nominatedCode: z.string(),
});

export const NominationsFileSchema = z.object({
  bySite: z.record(z.string(), z.array(NominatedPenetrationSchema)),
});

export const NominationsResponseSchema = z.object({
  siteId: IdSchema,
  penetrations: z.array(NominatedPenetrationSchema),
});

export const StockBalanceSchema = z.object({
  materialId: IdSchema,
  location: z.string(),
  quantity: finiteNumber,
});

export const StockFileSchema = z.object({
  asOf: z.string().min(1),
  balances: z.array(StockBalanceSchema),
});

export const MaterialSchema = z.object({
  id: IdSchema,
  name: z.string(),
  unit: z.string(),
});

export const SolutionMaterialSchema = z.object({
  internalCode: z.string(),
  materialId: IdSchema,
  quantityPerInstall: finiteNumber,
});

export const SolutionMaterialsFileSchema = z.object({
  materials: z.array(MaterialSchema),
  items: z.array(SolutionMaterialSchema),
});

export type SiteRecord = z.infer<typeof SiteSchema>;
export type NominatedPenetrationRecord = z.infer<typeof NominatedPenetrationSchema>;
export type StockBalanceRecord = z.infer<typeof StockBalanceSchema>;
export type MaterialRecord = z.infer<typeof MaterialSchema>;
export type SolutionMaterialRecord = z.infer<typeof SolutionMaterialSchema>;
export type SitesFile = z.infer<typeof SitesFileSchema>;
export type NominationsFile = z.infer<typeof NominationsFileSchema>;
export type StockFile = z.infer<typeof StockFileSchema>;
export type SolutionMaterialsFile = z.infer<typeof SolutionMaterialsFileSchema>;
