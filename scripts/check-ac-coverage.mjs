// Fails if any acceptance criterion in docs/slice-specification.md has no test
// referencing it as "AC <n>" or "AC<n>" (also matches lists such as "AC 1, 2, 3").
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Count the numbered items in section 4 of the spec, so a new criterion cannot go unchecked.
const spec = readFileSync("docs/slice-specification.md", "utf8");
const section = spec.split(/^## 4\. Acceptance criteria$/m)[1]?.split(/^## /m)[0] ?? "";
const AC_COUNT = section.match(/^\d+\. /gm)?.length ?? 0;
if (AC_COUNT === 0) {
  console.error("No acceptance criteria found in docs/slice-specification.md section 4.");
  process.exit(1);
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(test|spec)\.ts$/.test(p) ? [p] : [];
  });
}

const text = files("tests").map((f) => readFileSync(f, "utf8")).join("\n");
const covered = new Set();
for (const m of text.matchAll(/\bACs?\s*((?:\d+\s*(?:,|and|to|-)?\s*)+)/g)) {
  const nums = [...m[1].matchAll(/\d+/g)].map((n) => Number(n[0]));
  const isRange = /\bto\b|-/.test(m[1]);
  if (isRange && nums.length === 2) for (let i = nums[0]; i <= nums[1]; i++) covered.add(i);
  else nums.forEach((n) => covered.add(n));
}

const missing = Array.from({ length: AC_COUNT }, (_, i) => i + 1).filter((n) => !covered.has(n));
if (missing.length) {
  console.error(`Acceptance criteria with no referencing test: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`All ${AC_COUNT} acceptance criteria are referenced by tests.`);
