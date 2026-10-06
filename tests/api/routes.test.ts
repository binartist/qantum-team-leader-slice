import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getActions } from "@/app/api/sites/[id]/actions/route";
import { GET as getCandidates } from "@/app/api/sites/[id]/penetrations/[pid]/substitution-candidates/route";
import { POST as postSubstitution } from "@/app/api/sites/[id]/penetrations/[pid]/substitutions/route";
import { GET as getReadiness } from "@/app/api/sites/[id]/readiness/route";
import { POST as postEscalate } from "@/app/api/sites/[id]/shortages/[shortageId]/escalate/route";
import { POST as postWait } from "@/app/api/sites/[id]/shortages/[shortageId]/wait/route";
import { GET as getSites } from "@/app/api/sites/route";
import type { Dependencies } from "@/application";
import { UpstreamError, type NewShortageAction } from "@/ports";
import { setDependenciesForTests } from "@/server/deps";
import { getCurrentUser } from "@/server/identity";
import { postRequest, readResponse, routeContext, testDependencies } from "./support";

let deps: Dependencies;

beforeEach(() => {
  deps = testDependencies();
  setDependenciesForTests(deps);
});

afterEach(() => {
  setDependenciesForTests(null);
  vi.unstubAllEnvs();
});

function readiness(siteId: string): Promise<Response> {
  return getReadiness(new Request(`http://local/api/sites/${siteId}/readiness`), routeContext({ id: siteId }));
}

function wait(siteId: string, shortageId: string, body: string, key?: string): Promise<Response> {
  return postWait(postRequest(`http://local/api/sites/${siteId}/shortages/wait`, body, key), routeContext({ id: siteId, shortageId }));
}

function escalate(siteId: string, shortageId: string, body: string, key?: string): Promise<Response> {
  return postEscalate(postRequest(`http://local/api/sites/${siteId}/shortages/escalate`, body, key), routeContext({ id: siteId, shortageId }));
}

async function expectCache(
  response: Response,
): Promise<{ status: number; text: string; body: Record<string, unknown>; cache: string | null }> {
  const result = await readResponse(response);
  expect(result.cache).toBe("no-store");
  return result;
}

describe("site readiness over HTTP", () => {
  it("AC 10: sites A and B are computed independently, A clear and B blocked, with the shared-stock notice", async () => {
    const listed = await expectCache(await getSites());
    expect(listed.status).toBe(200);
    const sites = listed.body.sites as {
      id: string;
      crewStatus: string;
      shortageCount: number;
      dataProblemCount: number;
    }[];
    expect(sites.map((site) => [site.id, site.crewStatus, site.shortageCount, site.dataProblemCount])).toEqual([
      ["site-a", "clear", 0, 0],
      ["site-b", "blocked", 2, 0],
      ["site-c", "blocked", 1, 4],
      ["site-d", "nothing_planned", 0, 0],
    ]);
    for (const site of sites) {
      expect(Number.isInteger(site.shortageCount)).toBe(true);
      expect(Number.isInteger(site.dataProblemCount)).toBe(true);
    }

    const siteA = await expectCache(await readiness("site-a"));
    const siteB = await expectCache(await readiness("site-b"));
    expect(siteA.body.crewStatus).toBe("clear");
    expect(siteA.body.stockNotice).toBe("On hand, shared, not reserved");
    expect(siteB.body.crewStatus).toBe("blocked");
    expect(siteB.body.stockNotice).toBe("On hand, shared, not reserved");
    expect(siteB.body.stockAsOf).toBe("2026-10-03T08:00:00Z");
  });

  it("matches the sample outcomes for shortages, blockers, and candidates", async () => {
    const siteB = await expectCache(await readiness("site-b"));
    const shortages = siteB.body.shortages as {
      materialId: string;
      requiredQty: number;
      onHandQty: number | null;
      shortfallQty: number | null;
      penetrationIds: string[];
      kind: string;
    }[];
    const sealant = shortages.find((item) => item.materialId === "MAT-SEALANT");
    const collar = shortages.find((item) => item.materialId === "MAT-COLLAR-25");
    expect(sealant).toMatchObject({ kind: "short", requiredQty: 10, onHandQty: 8, shortfallQty: 2 });
    expect(sealant?.penetrationIds).toHaveLength(12);
    expect(collar).toMatchObject({ kind: "short", requiredQty: 4, onHandQty: 2, shortfallQty: 2 });
    expect(siteB.body.materials).toMatchObject({
      "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge", unit: "cartridge" },
      "MAT-COLLAR-25": { name: "Pipe collar for 25 mm pipe", unit: "each" },
    });
    const siteBPenetrations = siteB.body.penetrations as Record<
      string,
      { floor: string; location: string; nominatedCode: string; serviceType: string; serviceSize: string }
    >;
    expect(siteBPenetrations["pen-b-01"]).toEqual({
      floor: "L3",
      location: "Riser 2",
      nominatedCode: "0438",
      serviceType: "PEX Pipe",
      serviceSize: "Ø25mm",
    });
    expect(siteBPenetrations["pen-b-05"]).toEqual({
      floor: "L4",
      location: "Corridor south",
      nominatedCode: "0434",
      serviceType: "KELOX Pipe  - 13mm PE",
      serviceSize: "Ø32mm",
    });
    for (const penetration of Object.values(siteBPenetrations)) {
      expect(penetration.serviceType.length).toBeGreaterThan(0);
      expect(penetration.serviceSize.length).toBeGreaterThan(0);
    }

    const siteC = await expectCache(await readiness("site-c"));
    expect(siteC.body.crewStatus).toBe("blocked");
    const siteCShortages = siteC.body.shortages as { id: string; materialId: string; kind: string; requiredQty: number; onHandQty: number | null }[];
    expect(siteCShortages).toEqual([
      expect.objectContaining({ id: "site-c:MAT-MASTIC", materialId: "MAT-MASTIC", kind: "unknown", requiredQty: 1, onHandQty: null }),
    ]);
    const blockers = siteC.body.blockers as { id: string; reason: string; internalCode: string; penetrationId: string; mismatches?: string[] }[];
    // Only a solution_mismatch blocker carries mismatches.
    expect(blockers.find((blocker) => blocker.penetrationId === "pen-c-02")?.mismatches).toEqual(["insulation"]);
    expect(blockers.filter((blocker) => blocker.reason !== "solution_mismatch").every((blocker) => !("mismatches" in blocker))).toBe(true);
    expect(blockers.map((blocker) => [blocker.id, blocker.reason, blocker.internalCode, blocker.penetrationId])).toEqual([
      // AC 35: 0943's substrate is cut off in the catalogue, so it cannot be shown to fit.
      ["site-c:blocker.pen-c-01", "solution_mismatch", "0943", "pen-c-01"],
      // AC 35: pen-c-02 needs 90 min insulation; its nominated 0435 claims 60.
      ["site-c:blocker.pen-c-02", "solution_mismatch", "0435", "pen-c-02"],
      ["site-c:blocker.pen-c-03", "unknown_solution_code", "9999", "pen-c-03"],
      ["site-c:blocker.pen-c-04", "no_material_mapping", "0393", "pen-c-04"],
    ]);

    const siteD = await expectCache(await readiness("site-d"));
    expect(siteD.body.crewStatus).toBe("nothing_planned");

    const candidates = await expectCache(
      await getCandidates(new Request("http://local/api/sites/site-b/penetrations/pen-b-01/substitution-candidates"), routeContext({ id: "site-b", pid: "pen-b-01" })),
    );
    expect(candidates.body.notice).toBe("Catalogue match, not verified");
    expect(candidates.body.nominatedCode).toBe("0438");
    expect(candidates.body.status).toBe("ok");
    const rows = candidates.body.candidates as { internalCode: string; availability: { overall: string } }[];
    expect(rows.map((row) => [row.internalCode, row.availability.overall])).toEqual([
      // AC 33 (API): 0451 uses sealant, which Harbour Point is already short of, so one install fitting on hand is not enough.
      ["0451", "short"],
      ["0464", "no_material_mapping"],
    ]);
    const detailed = candidates.body.candidates as {
      internalCode: string;
      insulationMinutes: number | null;
      materials: Record<string, { name: string; unit: string }>;
    }[];
    expect(detailed.find((row) => row.internalCode === "0451")).toMatchObject({
      insulationMinutes: 60,
      materials: { "MAT-PUTTY": { name: "Fire putty pad", unit: "each" } },
    });
    expect(candidates.body.penetration).toEqual({
      id: "pen-b-01",
      floor: "L3",
      location: "Riser 2",
      serviceType: "PEX Pipe",
      serviceSize: "Ø25mm",
      nominatedCode: "0438",
      requiredIntegrityMinutes: 60,
      requiredInsulationMinutes: 30,
    });
    expect(candidates.text).not.toMatch(/compatible|approved/i);

    const listed = await expectCache(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    expect(listed.body.materials).toMatchObject({
      "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge", unit: "cartridge" },
      "MAT-COLLAR-25": { name: "Pipe collar for 25 mm pipe", unit: "each" },
    });
    expect(listed.body.penetrations).toMatchObject({
      "pen-b-01": { floor: "L3", location: "Riser 2", nominatedCode: "0438", serviceType: "PEX Pipe", serviceSize: "Ø25mm" },
    });
    expect(Object.keys(listed.body.penetrations as object)).toHaveLength(12);

    const siteAActions = await expectCache(await getActions(new Request("http://local/api/sites/site-a/actions"), routeContext({ id: "site-a" })));
    const siteAReadiness = await expectCache(await readiness("site-a"));
    expect(siteAReadiness.body.materials).toEqual({});
    expect(siteAReadiness.body.penetrations).toEqual({});
    expect(siteAActions.body.materials).toMatchObject({
      "MAT-WRAP": { name: "Intumescent wrap strip", unit: "metre" },
      "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge", unit: "cartridge" },
    });
    expect(siteAActions.body.penetrations).toMatchObject({
      "pen-a-01": { floor: "L2", location: "Corridor north", nominatedCode: "0344" },
    });
    expect(Object.keys(siteAActions.body.penetrations as object)).toHaveLength(6);
  });

  it("AC 9: stock down is 502 and never clear, malformed stock is upstream_invalid, and one failing site stays unavailable", async () => {
    setDependenciesForTests(testDependencies({ stock: "down" }));
    const failed = await expectCache(await readiness("site-a"));
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ code: "upstream_unavailable", message: "stock is unavailable." });
    expect(failed.body.crewStatus).toBeUndefined();

    const listed = await expectCache(await getSites());
    const sites = listed.body.sites as { id: string; crewStatus: string; shortageCount: number; dataProblemCount: number }[];
    expect(sites.map((site) => [site.crewStatus, site.shortageCount, site.dataProblemCount])).toEqual([
      ["unavailable", 0, 0],
      ["unavailable", 0, 0],
      ["unavailable", 0, 0],
      ["unavailable", 0, 0],
    ]);

    setDependenciesForTests(testDependencies({ stock: "malformed" }));
    const invalid = await expectCache(await readiness("site-b"));
    expect(invalid.status).toBe(502);
    expect(invalid.body).toEqual({ code: "upstream_invalid", message: "stock is invalid." });

    const base = testDependencies();
    setDependenciesForTests({
      ...base,
      nominations: {
        async getNominations(siteId: string) {
          if (siteId === "site-b") throw new UpstreamError("upstream_unavailable", "nominations");
          return base.nominations.getNominations(siteId);
        },
      },
    });
    const mixed = await expectCache(await getSites());
    expect(
      (mixed.body.sites as { id: string; crewStatus: string; shortageCount: number; dataProblemCount: number }[]).map((site) => [
        site.id,
        site.crewStatus,
        site.shortageCount,
        site.dataProblemCount,
      ]),
    ).toEqual([
      ["site-a", "clear", 0, 0],
      ["site-b", "unavailable", 0, 0],
      ["site-c", "blocked", 1, 4],
      ["site-d", "nothing_planned", 0, 0],
    ]);
  });

  it("an unknown or malformed site id is 404, and empty stock does not read as clear", async () => {
    const unknown = await expectCache(await readiness("no-such-site"));
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe("site_not_found");
    const malformed = await expectCache(await readiness("site b"));
    expect(malformed.status).toBe(404);
    expect(malformed.body.code).toBe("site_not_found");

    setDependenciesForTests(testDependencies({ stock: "empty" }));
    const empty = await expectCache(await readiness("site-a"));
    expect(empty.status).toBe(200);
    expect(empty.body.crewStatus).toBe("blocked");
  });
});

describe("shortage actions over HTTP", () => {
  it("an action recorded below the live shortfall lists as earlier, not current", async () => {
    const input: NewShortageAction = {
      siteId: "site-b",
      shortageId: "site-b:MAT-SEALANT",
      kind: "wait",
      escalateTo: null,
      note: "recorded below the live shortfall",
      shortfallQtyAtTime: 1,
      createdBy: "demo-leader",
      idempotencyKey: "earlier-sealant",
    };
    await deps.actions.appendShortageAction(input);
    const listed = await readResponse(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    const actions = listed.body.actions as { status: string; note: string | null }[];
    const row = actions.find((action) => action.note === "recorded below the live shortfall");
    expect(row?.status).toBe("earlier");
    expect(actions.filter((action) => action.note === "recorded below the live shortfall").map((action) => action.status)).not.toContain("current");
  });

  it("AC 5, 6: wait and escalate are accepted for unknown stock, and a blocker can be escalated but not waited on", async () => {
    const waited = await expectCache(await wait("site-c", "site-c:MAT-MASTIC", JSON.stringify({ note: "check the van" }), "wait-mastic"));
    expect(waited.status).toBe(201);
    expect(waited.body.created).toBe(true);
    const waitedRecord = waited.body.record as { kind: string; shortfallQtyAtTime: number | null; createdBy: string };
    expect(waitedRecord).toMatchObject({ kind: "wait", shortfallQtyAtTime: null, createdBy: getCurrentUser().id });

    const escalated = await expectCache(
      await escalate("site-c", "site-c:MAT-MASTIC", JSON.stringify({ escalateTo: "warehouse", note: "please count" }), "escalate-mastic"),
    );
    expect(escalated.status).toBe(201);
    const after = await expectCache(await readiness("site-c"));
    const shortage = (after.body.shortages as { id: string; state: string }[]).find((item) => item.id === "site-c:MAT-MASTIC");
    expect(shortage?.state).toBe("escalated");
    expect(after.body.crewStatus).toBe("blocked");

    const blockedWait = await expectCache(await wait("site-c", "site-c:blocker.pen-c-03", JSON.stringify({}), "wait-blocker"));
    expect(blockedWait.status).toBe(422);
    expect(blockedWait.body).toEqual({ code: "wait_not_allowed_for_blocker", message: "Wait is not allowed for a blocker." });

    const encodedBlocker = "site-c%3Ablocker.pen-c-03";
    const blockedEscalate = await expectCache(
      await escalate("site-c", encodedBlocker, JSON.stringify({ escalateTo: "purchasing" }), "escalate-blocker"),
    );
    expect(blockedEscalate.status).toBe(201);
    const blocked = await expectCache(await readiness("site-c"));
    const blocker = (blocked.body.blockers as { id: string; state: string }[]).find((item) => item.id === "site-c:blocker.pen-c-03");
    expect(blocker?.state).toBe("escalated");
    expect(blocked.body.crewStatus).toBe("blocked");

    // AC 35: a nominated solution that does not fit is a data problem: no wait, escalate accepted, mismatches named.
    const mismatchWait = await expectCache(await wait("site-c", "site-c:blocker.pen-c-02", JSON.stringify({}), "wait-mismatch"));
    expect(mismatchWait.status).toBe(422);
    expect(mismatchWait.body).toEqual({ code: "wait_not_allowed_for_blocker", message: "Wait is not allowed for a blocker." });
    const mismatchEscalate = await expectCache(
      await escalate("site-c", "site-c%3Ablocker.pen-c-02", JSON.stringify({ escalateTo: "purchasing" }), "escalate-mismatch"),
    );
    expect(mismatchEscalate.status).toBe(201);
    const afterMismatch = await expectCache(await readiness("site-c"));
    const mismatch = (afterMismatch.body.blockers as { id: string; state: string; mismatches?: string[] }[]).find(
      (item) => item.id === "site-c:blocker.pen-c-02",
    );
    expect(mismatch).toMatchObject({ state: "escalated", mismatches: ["insulation"] });
    expect(afterMismatch.body.crewStatus).toBe("blocked");
  });

  it("AC 11, 12, 13: wait returns 201 and stays blocked, a bad escalateTo is 422, and a missing shortage is 404", async () => {
    const created = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "due Friday" }), "wait-sealant"));
    expect(created.status).toBe(201);
    const record = created.body.record as { state?: string; kind: string; shortfallQtyAtTime: number; shortageId: string };
    expect(record).toMatchObject({ kind: "wait", shortfallQtyAtTime: 2, shortageId: "site-b:MAT-SEALANT" });
    const after = await expectCache(await readiness("site-b"));
    const sealant = (after.body.shortages as { materialId: string; state: string }[]).find((item) => item.materialId === "MAT-SEALANT");
    expect(sealant?.state).toBe("waiting");
    expect(after.body.crewStatus).toBe("blocked");

    const missingTarget = await expectCache(await escalate("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "x" }), "bad-target"));
    expect(missingTarget.status).toBe(422);
    expect(missingTarget.body.code).toBe("validation_failed");
    expect(missingTarget.text).toContain("escalateTo");
    expect(missingTarget.text).not.toContain("manager");

    const invalidTarget = await expectCache(
      await escalate("site-b", "site-b:MAT-SEALANT", JSON.stringify({ escalateTo: "manager" }), "bad-value"),
    );
    expect(invalidTarget.status).toBe(422);
    expect(invalidTarget.body.code).toBe("validation_failed");
    expect(invalidTarget.text).not.toContain("manager");

    const missing = await expectCache(await wait("site-b", "site-b:MAT-PUTTY", JSON.stringify({}), "missing-shortage"));
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("shortage_not_found");
  });

  it("accepts the shortage id both encoded and decoded", async () => {
    const encoded = await expectCache(await wait("site-b", "site-b%3AMAT-SEALANT", JSON.stringify({ note: "encoded" }), "encoded-key"));
    const decoded = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "decoded" }), "decoded-key"));
    expect(encoded.status).toBe(201);
    expect(decoded.status).toBe(201);
    expect((encoded.body.record as { shortageId: string }).shortageId).toBe("site-b:MAT-SEALANT");
    expect((decoded.body.record as { shortageId: string }).shortageId).toBe("site-b:MAT-SEALANT");
  });

  it("AC 16: a repeat returns the original with 200, a missing key is 400, and another user gets a new row", async () => {
    const first = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "original" }), "same-key"));
    const repeat = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "changed" }), "same-key"));
    expect(first.status).toBe(201);
    expect(repeat.status).toBe(200);
    expect(repeat.body.created).toBe(false);
    expect(repeat.body.record).toEqual(first.body.record);
    const listed = await expectCache(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    expect(listed.body.actions).toHaveLength(1);

    const missingKey = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "none" })));
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.code).toBe("idempotency_key_required");

    const firstUser = getCurrentUser().id;
    vi.stubEnv("DEMO_USER_ID", firstUser === "other-leader" ? "second-leader" : "other-leader");
    const other = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "other user" }), "same-key"));
    expect(other.status).toBe(201);
    expect((other.body.record as { id: string; createdBy: string }).id).not.toBe((first.body.record as { id: string }).id);
    expect((other.body.record as { createdBy: string }).createdBy).not.toBe(firstUser);
    const both = await expectCache(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    expect(both.body.actions).toHaveLength(2);
  });

  it("AC 17: a note over 500 characters is 422 and a body over 10000 bytes is 413", async () => {
    const marker = `LEAK${"n".repeat(497)}`;
    expect(marker.length).toBe(501);
    const longNote = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: marker }), "long-note"));
    expect(longNote.status).toBe(422);
    expect(longNote.body.code).toBe("validation_failed");
    expect(longNote.text).not.toContain("LEAK");

    const huge = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", "x".repeat(10_001), "huge-body"));
    expect(huge.status).toBe(413);
    expect(huge.body.code).toBe("payload_too_large");

    const keyFirst = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", "x".repeat(10_001)));
    expect(keyFirst.status).toBe(400);
    expect(keyFirst.body.code).toBe("idempotency_key_required");

    const pathFirst = await expectCache(await wait("bad id", "bad id:MAT", JSON.stringify({ note: "x" })));
    expect(pathFirst.status).toBe(404);
    expect(pathFirst.body.code).toBe("site_not_found");
  });

  it("rejects invalid JSON and unknown fields without echoing the submitted value", async () => {
    const invalid = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", "{", "bad-json"));
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("invalid_json");

    const extra = await expectCache(
      await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "ok", createdBy: "BODYLEAK" }), "extra-field"),
    );
    expect(extra.status).toBe(422);
    expect(extra.body.code).toBe("validation_failed");
    expect(extra.text).not.toContain("BODYLEAK");
  });

  it("a forced internal error returns the generic body and drops the note, path, and SQL", async () => {
    const note = "leader-note-do-not-leak";
    setDependenciesForTests({
      ...deps,
      actions: {
        ...deps.actions,
        async appendShortageAction(input: NewShortageAction) {
          throw new Error(`SQL failed at /Users/joe/workspace/node_modules/pg ${input.note}\n    at Module._compile`);
        },
      },
    });
    const failed = await expectCache(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note }), "boom"));
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ code: "internal_error", message: "Something went wrong." });
    expect(failed.text).not.toContain(note);
    expect(failed.text).not.toContain("node_modules");
    expect(failed.text).not.toContain("/Users");
    expect(failed.text).not.toContain("SQL");
    expect(failed.text).not.toContain("Module._compile");
  });
});

describe("substitution proposals over HTTP", () => {
  it("AC 23, 24: a non-candidate is 422, a stale nomination is 409, and a proposal stays proposed without changing readiness", async () => {
    const before = await expectCache(await readiness("site-b"));
    const notCandidate = await expectCache(
      await postSubstitution(
        postRequest(
          "http://local/api/sites/site-b/penetrations/pen-b-01/substitutions",
          JSON.stringify({ fromInternalCode: "0438", toInternalCode: "9999", reason: "wishful" }),
          "not-candidate",
        ),
        routeContext({ id: "site-b", pid: "pen-b-01" }),
      ),
    );
    expect(notCandidate.status).toBe(422);
    expect(notCandidate.body.code).toBe("not_a_candidate");

    const stale = await expectCache(
      await postSubstitution(
        postRequest(
          "http://local/api/sites/site-b/penetrations/pen-b-01/substitutions",
          JSON.stringify({ fromInternalCode: "0344", toInternalCode: "0451", reason: "wrong penetration" }),
          "stale",
        ),
        routeContext({ id: "site-b", pid: "pen-b-01" }),
      ),
    );
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("stale_nomination");

    const created = await expectCache(
      await postSubstitution(
        postRequest(
          "http://local/api/sites/site-b/penetrations/pen-b-01/substitutions",
          JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: "closer rating" }),
          "propose-0451",
        ),
        routeContext({ id: "site-b", pid: "pen-b-01" }),
      ),
    );
    expect(created.status).toBe(201);
    expect(created.body.record).toMatchObject({
      status: "proposed",
      reason: "closer rating",
      fromInternalCode: "0438",
      toInternalCode: "0451",
      createdBy: getCurrentUser().id,
    });
    const after = await expectCache(await readiness("site-b"));
    expect(after.body).toEqual(before.body);

    const repeat = await expectCache(
      await postSubstitution(
        postRequest(
          "http://local/api/sites/site-b/penetrations/pen-b-01/substitutions",
          JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: "a different reason" }),
          "propose-0451",
        ),
        routeContext({ id: "site-b", pid: "pen-b-01" }),
      ),
    );
    expect(repeat.status).toBe(200);
    expect(repeat.body.record).toEqual(created.body.record);

    const listed = await expectCache(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    expect(listed.body.proposals).toEqual([created.body.record]);
    expect(listed.cache).toBe("no-store");
  });
});

describe("candidate outcomes over HTTP", () => {
  it("AC 20 and 21: an unmatched code is ok and empty, an incomplete substrate has no candidates, and an unknown code says so", async () => {
    const unmatched = await expectCache(
      await getCandidates(new Request("http://local/candidates"), routeContext({ id: "site-a", pid: "pen-a-01" })),
    );
    expect(unmatched.status).toBe(200);
    expect(unmatched.body.nominatedCode).toBe("0344");
    expect(unmatched.body.status).toBe("ok");
    expect(unmatched.body.candidates).toEqual([]);
    expect(unmatched.body.notice).toBe("Catalogue match, not verified");

    const incomplete = await expectCache(
      await getCandidates(new Request("http://local/candidates"), routeContext({ id: "site-c", pid: "pen-c-01" })),
    );
    expect(incomplete.status).toBe(200);
    expect(incomplete.body.nominatedCode).toBe("0943");
    expect(incomplete.body.status).toBe("substrate_incomplete");
    expect(incomplete.body.candidates).toEqual([]);

    const unknown = await expectCache(
      await getCandidates(new Request("http://local/candidates"), routeContext({ id: "site-c", pid: "pen-c-03" })),
    );
    expect(unknown.status).toBe(200);
    expect(unknown.body.status).toBe("nominated_code_unknown");
    expect(unknown.body.candidates).toEqual([]);

    const nullInsulation = await expectCache(
      await getCandidates(new Request("http://local/candidates"), routeContext({ id: "site-b", pid: "pen-b-11" })),
    );
    expect(nullInsulation.body.penetration).toEqual({
      id: "pen-b-11",
      floor: "L5",
      location: "Riser 3",
      serviceType: "Copper Pipe",
      serviceSize: "Ø100mm",
      nominatedCode: "0334",
      requiredIntegrityMinutes: 60,
      requiredInsulationMinutes: null,
    });
  });
});

describe("path id failures", () => {
  it("AC 13: escalating a missing shortage is 404 and stores nothing", async () => {
    const missing = await expectCache(await escalate("site-b", "site-b:MAT-PUTTY", JSON.stringify({ escalateTo: "purchasing" }), "missing-escalate"));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ code: "shortage_not_found", message: "Shortage not found." });
    const listed = await expectCache(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    expect(listed.body.actions).toEqual([]);
  });

  it("a shortage id for another site is 404 with or without an idempotency key", async () => {
    const withKey = await expectCache(await wait("site-b", "site-a:MAT-SEALANT", JSON.stringify({ note: "wrong site" }), "cross-site"));
    const withoutKey = await expectCache(await wait("site-b", "site-a:MAT-SEALANT", JSON.stringify({ note: "wrong site" })));
    expect(withKey.status).toBe(404);
    expect(withoutKey.status).toBe(404);
    expect(withKey.body.code).toBe("shortage_not_found");
    expect(withoutKey.body.code).toBe("shortage_not_found");
    const listed = await expectCache(await getActions(new Request("http://local/api/sites/site-b/actions"), routeContext({ id: "site-b" })));
    expect(listed.body.actions).toEqual([]);
  });

  it.each(["%", "%E0%A4%A"])("an invalid percent-escape %s is 404 for site, penetration, and shortage ids", async (segment) => {
    const site = await expectCache(await readiness(segment));
    expect(site.status).toBe(404);
    expect(site.body.code).toBe("site_not_found");

    const penetration = await expectCache(
      await getCandidates(new Request("http://local/candidates"), routeContext({ id: "site-b", pid: segment })),
    );
    expect(penetration.status).toBe(404);
    expect(penetration.body.code).toBe("penetration_not_found");

    const shortage = await expectCache(await wait("site-b", segment, JSON.stringify({}), "bad-escape"));
    expect(shortage.status).toBe(404);
    expect(shortage.body.code).toBe("shortage_not_found");
  });
});
