import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientBoundaryOffenders } from "./client-boundary.mjs";
import { GET as getActions } from "@/app/api/sites/[id]/actions/route";
import { GET as getCandidates } from "@/app/api/sites/[id]/penetrations/[pid]/substitution-candidates/route";
import { GET as getReadiness } from "@/app/api/sites/[id]/readiness/route";
import { POST as postWait } from "@/app/api/sites/[id]/shortages/[shortageId]/wait/route";
import { GET as getSites } from "@/app/api/sites/route";
import { buildDependencies, getDependencies, setDependenciesForTests } from "@/server/deps";
import { readEnv } from "@/server/env";
import { log } from "@/application/log";
import { InternalError } from "@/ports";
import { postRequest, readResponse, routeContext, testDependencies } from "./support";

afterEach(() => {
  setDependenciesForTests(null);
  vi.unstubAllEnvs();
});

function filesUnder(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe("server boundary", () => {
  it("AC 28: no client module imports server code, and no public env name is a secret", () => {
    const sourceFiles = [...filesUnder("src"), "next.config.ts", ".env.example"].filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile());
    const secretNames: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        if (/SERVICE_KEY|SERVICE_ROLE|SECRET|PASSWORD|TOKEN|CREDENTIAL|service_role/i.test(match[0])) secretNames.push(match[0]);
      }
    }
    expect(clientBoundaryOffenders(process.cwd())).toEqual([]);
    expect(secretNames).toEqual([]);
  });

  const staticDir = path.join(".next", "static");
  const staticPresent = statSync(staticDir, { throwIfNoEntry: false })?.isDirectory() === true;

  it.skipIf(!staticPresent && process.env.REQUIRE_BUNDLE_SCAN !== "1")(
    "AC 28: scans .next/static for the service key (skipped when .next/static is absent; set REQUIRE_BUNDLE_SCAN=1 to require the bundle)",
    () => {
      if (!staticPresent) {
        throw new Error("REQUIRE_BUNDLE_SCAN=1 but .next/static is absent. Run the production build before this check.");
      }
      const hits: string[] = [];
      for (const file of filesUnder(staticDir)) {
        let text = "";
        try {
          text = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        if (text.includes("SUPABASE_SERVICE_KEY") || text.includes("service_role") || text.includes("DB_PASSWORD")) hits.push(file);
      }
      expect(hits).toEqual([]);
    },
  );

  it("AC 29: the composition root answers GET /api/sites with no-store", async () => {
    const response = await getSites();
    const result = await readResponse(response);
    expect(response.status).toBe(200);
    expect(result.cache).toBe("no-store");
    expect((result.body.sites as { id: string }[]).map((site) => site.id)).toEqual(["site-a", "site-b", "site-c", "site-d"]);
  });

  it("returns 500 internal_error in production when postgres is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "");
    vi.stubEnv("DB_HOST", "");
    vi.stubEnv("DB_USER", "");
    vi.stubEnv("DB_PASSWORD", "");
    vi.stubEnv("DB_NAME", "");
    setDependenciesForTests(null);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const response = await getSites();
    spy.mockRestore();
    vi.unstubAllEnvs();
    const result = await readResponse(response);
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(result.text).not.toContain("site-a");
    expect(result.text).not.toContain("memory");
    expect(result.cache).toBe("no-store");
    expect(lines.join("\n")).toContain("db_unconfigured");
  });

  it("does not log notes, keeps a reason token, and drops a reason that is not token-shaped", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    log("request_failed", { code: "validation_failed", note: "secret reason", status: 422, idempotencyKey: "key-1" });
    log("request_failed", { code: "internal_error", status: 500, reason: "db_tls_insecure" });
    log("request_failed", { code: "internal_error", status: 500, reason: "http://insecure.example" });
    log("db_config", {
      host: "db.example",
      port: 6543,
      user: "qantum_slice",
      database: "qantum_slice",
      ssl: "verify-full",
      passwordPresent: false,
      password: "db-password-marker",
    });
    spy.mockRestore();
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("validation_failed");
    expect(lines[0]).not.toContain("secret");
    expect(lines[0]).not.toContain("key-1");
    expect(lines[1]).toContain("db_tls_insecure");
    expect(lines[2]).not.toContain("insecure.example");
    expect(lines[3]).toContain("db.example");
    expect(lines[3]).toContain("6543");
    expect(lines[3]).toContain("qantum_slice");
    expect(lines[3]).toContain("verify-full");
    expect(lines[3]).toContain("false");
    expect(lines[3]).not.toContain("db-password-marker");
  });

  it("rejects an invalid DEMO_USER_ID with InternalError and config_invalid", () => {
    expect.assertions(3);
    try {
      readEnv({ NODE_ENV: "test", DEMO_USER_ID: "bad id" });
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect(error).toMatchObject({ name: "InternalError", message: "Something went wrong." });
      expect((error as InternalError).reason).toBe("config_invalid");
    }
  });

  it("AC 28: API response fixtures do not contain the database password", async () => {
    const marker = "db-password-marker";
    vi.stubEnv("DB_PASSWORD", marker);
    setDependenciesForTests(testDependencies());
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const responses = await Promise.all([
      getSites(),
      getReadiness(new Request("http://local/readiness"), routeContext({ id: "site-b" })),
      getActions(new Request("http://local/actions"), routeContext({ id: "site-b" })),
      getCandidates(new Request("http://local/candidates"), routeContext({ id: "site-b", pid: "pen-b-01" })),
      postWait(postRequest("http://local/wait", "{", "bad-json"), routeContext({ id: "site-b", shortageId: "site-b:MAT-SEALANT" })),
      postWait(postRequest("http://local/wait", JSON.stringify({ note: "x" }), "missing"), routeContext({ id: "site-b", shortageId: "site-b:MAT-PUTTY" })),
      getReadiness(new Request("http://local/readiness"), routeContext({ id: "no-such-site" })),
    ]);
    spy.mockRestore();
    for (const response of responses) {
      const result = await readResponse(response);
      expect(result.text).not.toContain(marker);
      expect(result.cache).toBe("no-store");
    }
    expect(lines.join("\n")).not.toContain(marker);
  });

  it("returns 500 in production when ACTIONS_STORE=memory and the body has no site data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "memory");
    vi.stubEnv("DB_HOST", "db.example");
    vi.stubEnv("DB_PASSWORD", "db-password-marker");
    setDependenciesForTests(null);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const result = await readResponse(await getSites());
    spy.mockRestore();
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(result.text).not.toContain("site-a");
    expect(result.text).not.toContain("db-password-marker");
    expect(result.cache).toBe("no-store");
    expect(lines.join("\n")).toContain("store_forbidden");
    expect(lines.join("\n")).not.toContain("db-password-marker");
  });

  it("returns 500 when the database password is missing and does not cache the failure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "postgres");
    vi.stubEnv("DB_HOST", "db.example");
    vi.stubEnv("DB_USER", "qantum_slice");
    vi.stubEnv("DB_PASSWORD", "");
    vi.stubEnv("DB_NAME", "qantum_slice");
    vi.stubEnv("DB_SSL", "require");
    setDependenciesForTests(null);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const failed = await readResponse(await getSites());
    spy.mockRestore();
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(failed.text).not.toContain("site-a");
    expect(lines.join("\n")).toContain("db_unconfigured");

    vi.stubEnv("DB_PASSWORD", "db-password-marker");
    const built = getDependencies();
    expect(built.catalogue.solutions.length).toBeGreaterThan(0);
    expect(typeof built.actions.listShortageActions).toBe("function");
  });

  it("returns 500 in production when DB_SSL=disable, logs the token, and does not cache the failure", async () => {
    const marker = "db-password-marker";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "postgres");
    vi.stubEnv("DB_HOST", "db.example");
    vi.stubEnv("DB_PORT", "6543");
    vi.stubEnv("DB_USER", "qantum_slice");
    vi.stubEnv("DB_PASSWORD", marker);
    vi.stubEnv("DB_NAME", "qantum_slice");
    vi.stubEnv("DB_SSL", "disable");
    setDependenciesForTests(null);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const failed = await readResponse(await getSites());
    spy.mockRestore();
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(failed.text).not.toContain("site-a");
    expect(failed.text).not.toContain(marker);
    expect(lines.join("\n")).toContain("db_tls_insecure");
    expect(lines.join("\n")).not.toContain(marker);

    vi.stubEnv("DB_SSL", "require");
    const logged: string[] = [];
    const again = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    const built = getDependencies();
    again.mockRestore();
    expect(built.catalogue.solutions.length).toBeGreaterThan(0);
    expect(logged.join("\n")).toContain("db_config");
    expect(logged.join("\n")).toContain("passwordPresent");
    expect(logged.join("\n")).not.toContain(marker);
  });

  it("builds a postgres store in production with TLS and allows disable outside production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "postgres");
    vi.stubEnv("DB_HOST", "db.example");
    vi.stubEnv("DB_USER", "qantum_slice");
    vi.stubEnv("DB_PASSWORD", "db-password-marker");
    vi.stubEnv("DB_NAME", "qantum_slice");
    vi.stubEnv("DB_SSL", "require");
    setDependenciesForTests(null);
    expect(buildDependencies().catalogue.solutions.length).toBeGreaterThan(0);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DB_SSL", "disable");
    vi.stubEnv("DB_HOST", "127.0.0.1");
    setDependenciesForTests(null);
    expect(buildDependencies().catalogue.solutions.length).toBeGreaterThan(0);
  });

  it("documents ACTIONS_STORE and the database settings", () => {
    const text = readFileSync(".env.example", "utf8");
    expect(text).toContain("ACTIONS_STORE=");
    expect(text).toMatch(/memory or postgres/i);
    expect(text).toMatch(/production must use postgres or leave it unset/i);
    expect(text).toContain("DB_HOST=");
    expect(text).toContain("DB_PASSWORD=");
    expect(text).toContain("6543");
    expect(text).toContain("5432");
    expect(text).not.toContain("SUPABASE_");
  });
});
