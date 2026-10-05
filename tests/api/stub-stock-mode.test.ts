import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function stock(mode: string | undefined, nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("ACTIONS_STORE", nodeEnv === "production" ? "postgres" : "memory");
  if (nodeEnv === "production") {
    vi.stubEnv("DB_HOST", "db.example");
    vi.stubEnv("DB_PORT", "5432");
    vi.stubEnv("DB_USER", "qantum_slice");
    vi.stubEnv("DB_PASSWORD", "db-password-marker");
    vi.stubEnv("DB_NAME", "qantum_slice");
    vi.stubEnv("DB_SSL", "require");
  }
  if (mode === undefined) vi.stubEnv("STUB_STOCK_MODE", "");
  else vi.stubEnv("STUB_STOCK_MODE", mode);
  const { buildDependencies } = await import("@/server/deps");
  const { UpstreamError } = await import("@/ports");
  return { pending: buildDependencies().stock.getStock(["MAT-SEALANT"]), UpstreamError };
}

describe("STUB_STOCK_MODE", () => {
  it("is ignored in production", async () => {
    const result = await stock("down", "production");
    expect((await result.pending).balances.length).toBeGreaterThan(0);
  });

  it("down and malformed fail closed outside production, empty has no balances, and an unknown value stays normal", async () => {
    const down = await stock("down", "development");
    await expect(down.pending).rejects.toBeInstanceOf(down.UpstreamError);
    await expect(down.pending).rejects.toMatchObject({ code: "upstream_unavailable" });
    const malformed = await stock("malformed", "test");
    await expect(malformed.pending).rejects.toMatchObject({ code: "upstream_invalid" });
    const empty = await stock("empty", "development");
    await expect(empty.pending).resolves.toMatchObject({ balances: [] });
    const normal = await stock("sideways", "development");
    expect((await normal.pending).balances.length).toBeGreaterThan(0);
    const omitted = await stock(undefined, "development");
    expect((await omitted.pending).balances.length).toBeGreaterThan(0);
  });
});
