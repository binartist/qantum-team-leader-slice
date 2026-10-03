// Fails if any acceptance criterion in docs/slice-specification.md has no test
// referencing it as "AC <n>" or "AC<n>" (also matches lists such as "AC 1, 2, 3").
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const AC_COUNT = 32;

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
