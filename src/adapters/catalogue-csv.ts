import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { buildCatalogue, type RawCatalogueRow } from "@/domain/catalogue";
import type { Catalogue } from "@/domain/types";

const MAX_CATALOGUE_BYTES = 1024 * 1024;

// Resolved from this file when no path is passed, so the default does not follow the process working directory.
// Kept out of module scope: a top-level `new URL(..., import.meta.url)` is rewritten while Next collects page data.
function defaultCataloguePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "solutions-excerpt.csv");
}

/**
 * The path must be trusted, never user input.
 */
export function loadCatalogueFromCsv(path: string = defaultCataloguePath()): Catalogue {
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
