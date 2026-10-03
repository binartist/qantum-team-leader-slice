import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { buildCatalogue, type RawCatalogueRow } from "@/domain/catalogue";
import type { Catalogue } from "@/domain/types";

// Resolved from this file so the default does not follow the process working directory.
const defaultCataloguePath = fileURLToPath(new URL("../../data/solutions-excerpt.csv", import.meta.url));
const MAX_CATALOGUE_BYTES = 1024 * 1024;

/**
 * The path must be trusted, never user input.
 */
export function loadCatalogueFromCsv(path: string = defaultCataloguePath): Catalogue {
  let size: number;
  try {
    size = statSync(path).size;
  } catch {
    throw new Error("catalogue file could not be read");
  }
  if (size > MAX_CATALOGUE_BYTES) {
    throw new Error("catalogue file is too large");
  }

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error("catalogue file could not be read");
  }
  const rows = parse<RawCatalogueRow>(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    max_record_size: 4096,
  });
  return buildCatalogue(rows);
}
