import { describe, expect, it } from "vitest";
import { getCachedCandidates, getCachedReadiness, getCachedSite } from "@/app/_lib/cached";

describe("page cache", () => {
  it("returns the same site, readiness, and candidate list the pages render", async () => {
    const site = await getCachedSite("site-a");
    expect(site?.name).toBe("Riverside Plaza, Block A");
    const readiness = await getCachedReadiness("site-a");
    expect(readiness.crewStatus).toBe("clear");
    const listed = await getCachedCandidates("site-b", "pen-b-01");
    const match = listed.candidates.find((candidate) => candidate.internalCode === "0451");
    expect(match?.insulationMinutes).toBe(60);
    expect(match?.materials["MAT-PUTTY"]?.name).toBe("Fire putty pad");
    expect(await getCachedSite("site-a")).toEqual(site);
  });
});
