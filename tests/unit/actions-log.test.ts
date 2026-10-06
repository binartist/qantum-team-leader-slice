import { describe, expect, it, vi } from "vitest";
import { listAllActions, type Dependencies } from "@/application";
import { UpstreamError } from "@/ports";
import { testDependencies } from "../api/support";

/** One site's nominations fail upstream, or are missing; the others read normally. */
function withSiteDown(siteId: string, failure: "upstream" | "missing" = "upstream"): Dependencies {
  const deps = testDependencies();
  return {
    ...deps,
    nominations: {
      getNominations: async (id: string) => {
        if (id !== siteId) return deps.nominations.getNominations(id);
        if (failure === "missing") return null;
        throw new UpstreamError("upstream_unavailable", "nominations");
      },
    },
  };
}

describe("AC 43: the actions log lists every site", () => {
  it("returns every site in list order, with that site's actions", async () => {
    const listed = await listAllActions(testDependencies());
    expect(listed.sites.map((site) => site.siteId)).toEqual(["site-a", "site-b", "site-c", "site-d"]);
    expect(listed.sites.map((site) => site.siteName)).toEqual([
      "Riverside Plaza, Block A",
      "Harbour Point, Levels 3 to 5",
      "Kingsway Works, Phase 2",
      "Old Mill Annex",
    ]);
    for (const site of listed.sites) {
      expect(site.status).toBe("ready");
      if (site.status !== "ready") continue;
      expect(site.listed.actions).toEqual([]);
      expect(site.listed.proposals).toEqual([]);
    }
    const harbour = listed.sites[1];
    expect(harbour?.status).toBe("ready");
    if (harbour?.status === "ready") expect(harbour.listed.materials["MAT-SEALANT"]?.name).toBe("Intumescent sealant, 310 ml cartridge");
  });

  it("keeps a missing or upstream-failing site in place as unavailable, and logs why", async () => {
    for (const failure of ["missing", "upstream"] as const) {
      const lines: string[] = [];
      const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
      try {
        const listed = await listAllActions(withSiteDown("site-b", failure));
        expect(listed.sites.map((site) => [site.siteId, site.status])).toEqual([
          ["site-a", "ready"],
          ["site-b", "unavailable"],
          ["site-c", "ready"],
          ["site-d", "ready"],
        ]);
        expect(listed.sites[1]).toEqual({
          status: "unavailable",
          siteId: "site-b",
          siteName: "Harbour Point, Levels 3 to 5",
        });
      } finally {
        spy.mockRestore();
      }
      const events = lines.map((line) => JSON.parse(line) as { event?: string; siteId?: string; code?: string });
      expect(events).toContainEqual({
        event: "actions_unchecked",
        siteId: "site-b",
        code: failure === "missing" ? "site_not_found" : "upstream_unavailable",
        ...(failure === "upstream" ? { system: "nominations" } : {}),
      });
    }
  });

  it("throws when every site is unavailable, so the page cannot read as nothing recorded", async () => {
    await expect(listAllActions(testDependencies({ stock: "down" }))).rejects.toMatchObject({
      name: "UpstreamError",
      code: "upstream_unavailable",
      system: "sites",
    });
  });

  it("rethrows an error that is not an upstream or missing site", async () => {
    const deps = testDependencies();
    const wired: Dependencies = {
      ...deps,
      sites: {
        ...deps.sites,
        getSite: async (id: string) => {
          if (id === "site-c") throw new Error("boom");
          return deps.sites.getSite(id);
        },
      },
    };
    await expect(listAllActions(wired)).rejects.toThrow("boom");
  });

  it("returns no sections when there are no sites", async () => {
    await expect(listAllActions(testDependencies({ sites: "empty" }))).resolves.toEqual({ sites: [] });
  });
});
