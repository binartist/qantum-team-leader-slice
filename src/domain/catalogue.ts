import { isIncompleteSubstrate, normaliseText } from "./normalise";
import type { Catalogue, Orientation, Solution } from "./types";

export type RawCatalogueRow = Record<string, string>;

const COLUMN = {
  internalCode: "Internal Code",
  supplierRefCode: "Supplier Ref. Code",
  supplier: "Supplier",
  orientation: "Orientation",
  substrate: "Substrate",
  serviceClassification: "Service Classification",
  serviceType: "Service Type",
  serviceSize: "Service Size",
  integrity: "Integrity",
  insulation: "Insulation",
  serviceTypeOption: "Service Type Option",
  substrateOption: "Substrate Option",
} as const;

type ColumnName = (typeof COLUMN)[keyof typeof COLUMN];

const NUMERIC = /^\d+(?:\.\d+)?$/;
const CELL_PREVIEW_LENGTH = 30;

function cell(row: RawCatalogueRow, column: ColumnName, rowNumber: number): string {
  const value = row[column];
  if (value === undefined) {
    throw new Error(`missing column ${JSON.stringify(column)} on catalogue row ${rowNumber}`);
  }
  return value;
}

function preview(raw: string): string {
  const text = raw.length > CELL_PREVIEW_LENGTH ? `${raw.slice(0, CELL_PREVIEW_LENGTH)}…` : raw;
  return JSON.stringify(text);
}

function parseOrientation(raw: string, internalCode: string): Orientation {
  if (raw === "Wall" || raw === "Floor" || raw === "Ceiling") return raw;
  throw new Error(`unknown orientation ${preview(raw)} for internal code ${preview(internalCode)}`);
}

function parseMinutes(raw: string, field: string, internalCode: string): number {
  const trimmed = raw.trim();
  if (!NUMERIC.test(trimmed)) {
    throw new Error(`non-numeric ${field} ${preview(raw)} for internal code ${preview(internalCode)}`);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new Error(`non-finite ${field} ${preview(raw)} for internal code ${preview(internalCode)}`);
  }
  return value;
}

function parseInsulation(raw: string, internalCode: string): number | null {
  if (raw.trim() === "-") return null;
  return parseMinutes(raw, "insulation", internalCode);
}

export function buildCatalogue(rows: readonly RawCatalogueRow[]): Catalogue {
  const solutions: Solution[] = [];
  const byCode = new Map<string, Solution>();
  const incompleteCodes: string[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const internalCode = cell(raw, COLUMN.internalCode, rowNumber);
    const substrateDetail = cell(raw, COLUMN.substrate, rowNumber);
    const serviceType = cell(raw, COLUMN.serviceType, rowNumber);
    const serviceSize = cell(raw, COLUMN.serviceSize, rowNumber);
    const substrateIncomplete = isIncompleteSubstrate(substrateDetail);

    if (byCode.has(internalCode)) {
      throw new Error(`duplicate internal code ${preview(internalCode)}`);
    }

    const solution: Solution = {
      internalCode,
      supplierRefCode: cell(raw, COLUMN.supplierRefCode, rowNumber),
      supplier: cell(raw, COLUMN.supplier, rowNumber),
      orientation: parseOrientation(cell(raw, COLUMN.orientation, rowNumber), internalCode),
      substrateDetail,
      substrateOption: cell(raw, COLUMN.substrateOption, rowNumber),
      serviceClassification: cell(raw, COLUMN.serviceClassification, rowNumber),
      serviceType,
      serviceTypeOption: cell(raw, COLUMN.serviceTypeOption, rowNumber),
      serviceSize,
      integrityMinutes: parseMinutes(cell(raw, COLUMN.integrity, rowNumber), "integrity", internalCode),
      insulationMinutes: parseInsulation(cell(raw, COLUMN.insulation, rowNumber), internalCode),
      key: {
        substrate: normaliseText(substrateDetail),
        serviceType: normaliseText(serviceType),
        serviceSize: normaliseText(serviceSize),
      },
      substrateIncomplete,
    };

    Object.freeze(solution.key);
    const frozen = Object.freeze(solution);
    solutions.push(frozen);
    byCode.set(internalCode, frozen);
    if (substrateIncomplete) incompleteCodes.push(internalCode);
  });

  return { solutions: Object.freeze(solutions), byCode, incompleteCodes: Object.freeze(incompleteCodes) };
}
