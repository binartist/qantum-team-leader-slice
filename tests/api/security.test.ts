import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getActions } from "@/app/api/sites/[id]/actions/route";
import { GET as getCandidates } from "@/app/api/sites/[id]/penetrations/[pid]/substitution-candidates/route";
import { GET as getReadiness } from "@/app/api/sites/[id]/readiness/route";
import { POST as postWait } from "@/app/api/sites/[id]/shortages/[shortageId]/wait/route";
import { GET as getSites } from "@/app/api/sites/route";
import { buildDependencies, getDependencies, setDependenciesForTests } from "@/server/deps";
import { readEnv } from "@/server/env";
import { log } from "@/server/log";
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

function forbiddenSpecifier(file: string, specifier: string): boolean {
  if (specifier.startsWith("@/")) {
    const target = specifier.slice(2);
    return target === "server" || target.startsWith("server/") || target === "adapters" || target.startsWith("adapters/") || target === "ports" || target.startsWith("ports/");
  }
  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  const relative = path.relative(path.resolve("src"), resolved);
  return relative === "server" || relative.startsWith(`server${path.sep}`) || relative === "adapters" || relative.startsWith(`adapters${path.sep}`) || relative === "ports" || relative.startsWith(`ports${path.sep}`);
}

describe("server boundary", () => {
  it("AC 28: no client module imports server code, and no public env name is a secret", () => {
    const sourceFiles = [...filesUnder("src"), "next.config.ts", ".env.example"].filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile());
    const offenders: string[] = [];
    const secretNames: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      if (text.includes('"use client"') || text.includes("'use client'")) {
        for (const match of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
          const specifier = match[1];
          if (specifier && forbiddenSpecifier(file, specifier)) offenders.push(`${file} -> ${specifier}`);
        }
      }
      for (const match of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        if (/SERVICE_KEY|SERVICE_ROLE|SECRET|PASSWORD|TOKEN|CREDENTIAL|service_role/i.test(match[0])) secretNames.push(match[0]);
      }
    }
    expect(offenders).toEqual([]);
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
        if (text.includes("SUPABASE_SERVICE_KEY") || text.includes("service_role")) hits.push(file);
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

  it("returns 500 internal_error in production when supabase is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("ACTIONS_STORE", "");
    setDependenciesForTests(null);
    const response = await getSites();
    vi.unstubAllEnvs();
    const result = await readResponse(response);
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(result.text).not.toContain("site-a");
    expect(result.text).not.toContain("memory");
    expect(result.cache).toBe("no-store");
  });

  it("does not log notes, keeps a reason token, and drops a reason that is not token-shaped", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    log("request_failed", { code: "validation_failed", note: "secret reason", status: 422, idempotencyKey: "key-1" });
    log("request_failed", { code: "internal_error", status: 500, reason: "supabase_url_insecure" });
    log("request_failed", { code: "internal_error", status: 500, reason: "http://insecure.example" });
    spy.mockRestore();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("validation_failed");
    expect(lines[0]).not.toContain("secret");
    expect(lines[0]).not.toContain("key-1");
    expect(lines[1]).toContain("supabase_url_insecure");
    expect(lines[2]).not.toContain("insecure.example");
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

  it("AC 28: API response fixtures do not contain the service key", async () => {
    const marker = "service-key-marker";
    vi.stubEnv("SUPABASE_SERVICE_KEY", marker);
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
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    setDependenciesForTests(null);
    const result = await readResponse(await getSites());
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(result.text).not.toContain("site-a");
    expect(result.cache).toBe("no-store");
  });

  it("rejects an http Supabase URL in production, logs the token, and does not cache the failure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "supabase");
    vi.stubEnv("SUPABASE_URL", "http://insecure.example");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "service-key-marker");
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
    expect(failed.text).not.toContain("insecure.example");
    expect(failed.text).not.toContain("service-key-marker");
    expect(lines.join("\n")).toContain("supabase_url_insecure");
    expect(lines.join("\n")).not.toContain("insecure.example");
    expect(lines.join("\n")).not.toContain("service-key-marker");

    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    const built = getDependencies();
    expect(built.catalogue.solutions.length).toBeGreaterThan(0);
    expect(typeof built.actions.listShortageActions).toBe("function");
  });

  it("builds with an https Supabase URL in production and an http URL outside production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTIONS_STORE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "service-key-marker");
    setDependenciesForTests(null);
    expect(buildDependencies().catalogue.solutions.length).toBeGreaterThan(0);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "local-service-key");
    setDependenciesForTests(null);
    expect(buildDependencies().catalogue.solutions.length).toBeGreaterThan(0);
  });

  it("documents ACTIONS_STORE for production", () => {
    const text = readFileSync(".env.example", "utf8");
    expect(text).toContain("ACTIONS_STORE=");
    expect(text).toMatch(/production must use supabase or leave it unset/i);
  });
});
