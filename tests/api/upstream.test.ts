import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getCandidates } from "@/app/api/sites/[id]/penetrations/[pid]/substitution-candidates/route";
import { GET as getReadiness } from "@/app/api/sites/[id]/readiness/route";
import { GET as getSites } from "@/app/api/sites/route";
import type { Dependencies } from "@/application";
import { UpstreamError } from "@/ports";
import { setDependenciesForTests } from "@/server/deps";
import { readResponse, routeContext, testDependencies } from "./support";

let deps: Dependencies;

beforeEach(() => {
  deps = testDependencies();
  setDependenciesForTests(deps);
});

afterEach(() => {
  setDependenciesForTests(null);
  vi.restoreAllMocks();
});

function readiness(siteId: string): Promise<Response> {
  return getReadiness(new Request(`http://local/readiness`), routeContext({ id: siteId }));
}

function candidates(siteId: string, penetrationId: string): Promise<Response> {
  return getCandidates(new Request("http://local/candidates"), routeContext({ id: siteId, pid: penetrationId }));
}

async function crewStatuses(): Promise<[string, string][]> {
  const listed = await readResponse(await getSites());
  expect(listed.cache).toBe("no-store");
  return (listed.body.sites as { id: string; crewStatus: string }[]).map((site) => [site.id, site.crewStatus]);
}

describe("upstream failures", () => {
  it.each([
    ["nominations", "nominations"],
    ["solutionMaterials", "solution_materials"],
  ] as const)("AC 9: %s down is upstream_unavailable and no site is clear", async (mode, system) => {
    setDependenciesForTests(testDependencies({ [mode]: "down" }));
    const failed = await readResponse(await readiness("site-a"));
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ code: "upstream_unavailable", message: `${system} is unavailable.` });
    const statuses = await crewStatuses();
    expect(statuses.every(([, status]) => status !== "clear")).toBe(true);
    expect(statuses.every(([, status]) => status === "unavailable")).toBe(true);
  });

  it.each([
    ["nominations", "nominations"],
    ["solutionMaterials", "solution_materials"],
  ] as const)("AC 9: malformed %s reaches HTTP as upstream_invalid and no site is clear", async (mode, system) => {
    setDependenciesForTests(testDependencies({ [mode]: "malformed" }));
    const failed = await readResponse(await readiness("site-a"));
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ code: "upstream_invalid", message: `${system} is invalid.` });
    const statuses = await crewStatuses();
    expect(statuses.every(([, status]) => status === "unavailable")).toBe(true);
  });

  it("a nomination row for another site is upstream_invalid and that site is unavailable", async () => {
    const nominations = deps.nominations;
    setDependenciesForTests({
      ...deps,
      nominations: {
        async getNominations(siteId) {
          const rows = await nominations.getNominations(siteId);
          if (siteId !== "site-a" || !rows || rows.length === 0) return rows;
          const [first] = rows;
          if (!first) return rows;
          return [{ ...first, siteId: "site-other" }];
        },
      },
    });
    const failed = await readResponse(await readiness("site-a"));
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ code: "upstream_invalid", message: "nominations is invalid." });
    expect(failed.cache).toBe("no-store");

    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    expect(await crewStatuses()).toEqual([
      ["site-a", "unavailable"],
      ["site-b", "blocked"],
      ["site-c", "blocked"],
      ["site-d", "nothing_planned"],
    ]);
    expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
      { event: "upstream_failed", code: "upstream_invalid", system: "nominations" },
    ]);
  });

  it("a stock failure logs upstream_failed once per site with only code and system", async () => {
    setDependenciesForTests(testDependencies({ stock: "down" }));
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const statuses = await crewStatuses();
    expect(statuses).toEqual([
      ["site-a", "unavailable"],
      ["site-b", "unavailable"],
      ["site-c", "unavailable"],
      ["site-d", "unavailable"],
    ]);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(JSON.parse(line)).toEqual({ event: "upstream_failed", code: "upstream_unavailable", system: "stock" });
    }
  });

  it("a failure of the sites port stays a 502", async () => {
    setDependenciesForTests({
      ...deps,
      sites: {
        async listSites() {
          throw new UpstreamError("upstream_unavailable", "sites");
        },
        async getSite() {
          return null;
        },
      },
    });
    const failed = await readResponse(await getSites());
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ code: "upstream_unavailable", message: "sites is unavailable." });
    expect(failed.cache).toBe("no-store");
  });

  it("candidate routes fail closed when stock or nominations fail", async () => {
    setDependenciesForTests(testDependencies({ stock: "down" }));
    const stockDown = await readResponse(await candidates("site-b", "pen-b-01"));
    expect(stockDown.status).toBe(502);
    expect(stockDown.body).toEqual({ code: "upstream_unavailable", message: "stock is unavailable." });
    expect(stockDown.text).not.toContain("in_stock");

    setDependenciesForTests(testDependencies({ nominations: "down" }));
    const nominationsDown = await readResponse(await candidates("site-b", "pen-b-01"));
    expect(nominationsDown.status).toBe(502);
    expect(nominationsDown.body).toEqual({ code: "upstream_unavailable", message: "nominations is unavailable." });
    expect(nominationsDown.text).not.toContain("in_stock");

    setDependenciesForTests(testDependencies({ stock: "malformed" }));
    const malformed = await readResponse(await candidates("site-b", "pen-b-01"));
    expect(malformed.status).toBe(502);
    expect(malformed.body).toEqual({ code: "upstream_invalid", message: "stock is invalid." });
    expect(malformed.text).not.toContain("in_stock");
  });
});
