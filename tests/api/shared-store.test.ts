import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { testDependencies } from "./support";

// Next bundles each route and page separately, so this module can be evaluated more than once in one process.
// Pages read and API routes write; both must see the same memory store.
beforeEach(() => {
  vi.stubEnv("ACTIONS_STORE", "memory");
  vi.resetModules();
});

afterEach(() => {
  const overrideKey = Symbol.for("qantum.team-leader.dependencies.override");
  (globalThis as Record<symbol, unknown>)[overrideKey] = null;
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("two evaluations of the dependency module share one memory store", async () => {
  const first = await import("@/server/deps");
  vi.resetModules();
  const second = await import("@/server/deps");
  expect(second.getDependencies().actions).toBe(first.getDependencies().actions);
});

it("a test override set on one evaluation is what the next evaluation returns", async () => {
  const first = await import("@/server/deps");
  const override = testDependencies();
  first.setDependenciesForTests(override);
  vi.resetModules();
  const second = await import("@/server/deps");
  try {
    expect(second.getDependencies()).toBe(override);
  } finally {
    second.setDependenciesForTests(null);
  }
});
