import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SOURCE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const FORBIDDEN_ROOTS = ["server", "adapters", "ports"];

export function clientBoundaryOffenders(root) {
  const src = path.join(root, "src");
  if (!existsSync(src)) return [];
  const offenders = [];
  for (const client of filesUnder(src).filter(isClientModule)) {
    const seen = new Set();
    const queue = [client];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      const text = readFileSync(current, "utf8");
      for (const specifier of importSpecifiers(text)) {
        if (forbiddenSpecifier(current, specifier, root)) {
          offenders.push(`${path.relative(root, client)} -> ${specifier} via ${path.relative(root, current)}`);
        }
        const resolved = resolveLocal(current, specifier, root);
        if (resolved && !seen.has(resolved) && !forbiddenSpecifier(current, specifier, root)) queue.push(resolved);
      }
    }
  }
  return offenders;
}

function isClientModule(file) {
  const text = readFileSync(file, "utf8");
  return text.includes('"use client"') || text.includes("'use client'");
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

function importSpecifiers(text) {
  const specs = [];
  for (const match of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    if (match[1]) specs.push(match[1]);
  }
  return specs;
}

function forbiddenSpecifier(fromFile, specifier, root) {
  // The database driver is server-only.
  if (specifier === "pg" || specifier.startsWith("pg/")) return true;
  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    return FORBIDDEN_ROOTS.some((name) => rest === name || rest.startsWith(`${name}/`));
  }
  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const relative = path.relative(path.join(root, "src"), resolved);
  return FORBIDDEN_ROOTS.some((name) => relative === name || relative.startsWith(`${name}${path.sep}`));
}

function resolveLocal(fromFile, specifier, root) {
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(fromFile), specifier)
      : null;
  if (!base) return null;
  const candidates = [base, ...SOURCE_EXT.map((ext) => `${base}${ext}`), ...SOURCE_EXT.map((ext) => path.join(base, `index${ext}`))];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}
