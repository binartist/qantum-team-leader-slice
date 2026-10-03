import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getActions } from "@/app/api/sites/[id]/actions/route";
import { POST as postSubstitution } from "@/app/api/sites/[id]/penetrations/[pid]/substitutions/route";
import { GET as getReadiness } from "@/app/api/sites/[id]/readiness/route";
import { POST as postEscalate } from "@/app/api/sites/[id]/shortages/[shortageId]/escalate/route";
import { POST as postWait } from "@/app/api/sites/[id]/shortages/[shortageId]/wait/route";
import type { Dependencies } from "@/application";
import { setDependenciesForTests } from "@/server/deps";
import { postRequest, readResponse, routeContext, testDependencies } from "./support";

let deps: Dependencies;

beforeEach(() => {
  deps = testDependencies();
  setDependenciesForTests(deps);
});

afterEach(() => {
  setDependenciesForTests(null);
});

function readiness(siteId: string): Promise<Response> {
  return getReadiness(new Request(`http://local/api/sites/${siteId}/readiness`), routeContext({ id: siteId }));
}

function wait(siteId: string, shortageId: string, body: string, key: string): Promise<Response> {
  return postWait(postRequest(`http://local/wait`, body, key), routeContext({ id: siteId, shortageId }));
}

function escalate(siteId: string, shortageId: string, body: string, key: string): Promise<Response> {
  return postEscalate(postRequest(`http://local/escalate`, body, key), routeContext({ id: siteId, shortageId }));
}

function propose(siteId: string, penetrationId: string, body: string, key: string): Promise<Response> {
  return postSubstitution(postRequest(`http://local/substitutions`, body, key), routeContext({ id: siteId, pid: penetrationId }));
}

async function stored(siteId: string): Promise<{ actions: { id: string; kind: string; note: string | null }[]; proposals: { id: string }[] }> {
  const result = await readResponse(await getActions(new Request(`http://local/api/sites/${siteId}/actions`), routeContext({ id: siteId })));
  expect(result.cache).toBe("no-store");
  return result.body as { actions: { id: string; kind: string; note: string | null }[]; proposals: { id: string }[] };
}

function raiseStock(extra: number): void {
  const stock = deps.stock;
  setDependenciesForTests({
    ...deps,
    stock: {
      async getStock(materialIds) {
        const result = await stock.getStock(materialIds);
        return {
          asOf: result.asOf,
          balances: result.balances.map((balance) => ({ ...balance, quantity: balance.quantity + extra })),
        };
      },
    },
  });
}

function changeNomination(penetrationId: string, nominatedCode: string): void {
  const nominations = deps.nominations;
  setDependenciesForTests({
    ...deps,
    nominations: {
      async getNominations(siteId) {
        const rows = await nominations.getNominations(siteId);
        if (!rows) return null;
        return rows.map((row) => (row.id === penetrationId ? { ...row, nominatedCode } : row));
      },
    },
  });
}

describe("idempotency lookup before business checks", () => {
  it("AC 16: a wait replay returns the original after the shortage has gone", async () => {
    const first = await readResponse(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "original" }), "replay-wait"));
    expect(first.status).toBe(201);
    raiseStock(100);
    const covered = await readResponse(await readiness("site-b"));
    const shortages = covered.body.shortages as { id: string }[];
    expect(shortages.some((item) => item.id === "site-b:MAT-SEALANT")).toBe(false);

    const replay = await readResponse(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "changed" }), "replay-wait"));
    expect(replay.status).toBe(200);
    expect(replay.body.created).toBe(false);
    expect(replay.body.record).toEqual(first.body.record);
    expect((await stored("site-b")).actions).toHaveLength(1);
  });

  it("AC 16: an escalate replay returns the original after the shortage has gone", async () => {
    const body = JSON.stringify({ escalateTo: "purchasing", note: "original" });
    const first = await readResponse(await escalate("site-b", "site-b:MAT-SEALANT", body, "replay-escalate"));
    expect(first.status).toBe(201);
    raiseStock(100);
    const covered = await readResponse(await readiness("site-b"));
    expect((covered.body.shortages as { id: string }[]).some((item) => item.id === "site-b:MAT-SEALANT")).toBe(false);

    const replay = await readResponse(
      await escalate("site-b", "site-b:MAT-SEALANT", JSON.stringify({ escalateTo: "warehouse", note: "changed" }), "replay-escalate"),
    );
    expect(replay.status).toBe(200);
    expect(replay.body.created).toBe(false);
    expect(replay.body.record).toEqual(first.body.record);
    expect((await stored("site-b")).actions).toHaveLength(1);
  });

  it("AC 16: a blocker escalate repeats as the original row", async () => {
    const body = JSON.stringify({ escalateTo: "purchasing", note: "blocker" });
    const first = await readResponse(await escalate("site-c", "site-c:blocker.pen-c-03", body, "replay-blocker"));
    const second = await readResponse(
      await escalate("site-c", "site-c:blocker.pen-c-03", JSON.stringify({ escalateTo: "warehouse", note: "changed" }), "replay-blocker"),
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.record).toEqual(first.body.record);
    expect((await stored("site-c")).actions).toHaveLength(1);
  });

  it("AC 16: a proposal replay returns the original after the nomination changes", async () => {
    const original = JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: "closer rating" });
    const first = await readResponse(await propose("site-b", "pen-b-01", original, "replay-proposal"));
    expect(first.status).toBe(201);
    changeNomination("pen-b-01", "0344");

    const fresh = await readResponse(
      await propose("site-b", "pen-b-01", original, "fresh-after-change"),
    );
    expect(fresh.status).toBe(409);
    expect(fresh.body.code).toBe("stale_nomination");

    const replay = await readResponse(
      await propose("site-b", "pen-b-01", JSON.stringify({ fromInternalCode: "0344", toInternalCode: "9999", reason: "changed" }), "replay-proposal"),
    );
    expect(replay.status).toBe(200);
    expect(replay.body.created).toBe(false);
    expect(replay.body.record).toEqual(first.body.record);
    expect((await stored("site-b")).proposals).toHaveLength(1);
  });

  it("the same key on a different shortage is 409 and stores nothing", async () => {
    const first = await readResponse(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "sealant" }), "rebind"));
    expect(first.status).toBe(201);
    const reused = await readResponse(await wait("site-b", "site-b:MAT-COLLAR-25", JSON.stringify({ note: "collar" }), "rebind"));
    expect(reused.status).toBe(409);
    expect(reused.body).toEqual({
      code: "idempotency_key_reused",
      message: "The Idempotency-Key was used for a different request.",
    });
    expect(reused.cache).toBe("no-store");
    const actions = (await stored("site-b")).actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]?.note).toBe("sealant");
  });

  it("the same key for wait then escalate is 409 and stores nothing new", async () => {
    const first = await readResponse(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "waiting" }), "kind-switch"));
    expect(first.status).toBe(201);
    const reused = await readResponse(
      await escalate("site-b", "site-b:MAT-SEALANT", JSON.stringify({ escalateTo: "purchasing" }), "kind-switch"),
    );
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("idempotency_key_reused");
    const actions = (await stored("site-b")).actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe("wait");
  });

  it("the same key on a different penetration or site is 409 and stores nothing new", async () => {
    const body = JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: "closer rating" });
    const first = await readResponse(await propose("site-b", "pen-b-01", body, "proposal-rebind"));
    expect(first.status).toBe(201);
    const otherPenetration = await readResponse(await propose("site-b", "pen-b-02", body, "proposal-rebind"));
    expect(otherPenetration.status).toBe(409);
    expect(otherPenetration.body.code).toBe("idempotency_key_reused");
    const otherSite = await readResponse(
      await propose("site-a", "pen-a-01", JSON.stringify({ fromInternalCode: "0344", toInternalCode: "0451", reason: "other site" }), "proposal-rebind"),
    );
    expect(otherSite.status).toBe(409);
    expect(otherSite.body.code).toBe("idempotency_key_reused");
    expect((await stored("site-b")).proposals).toHaveLength(1);
    expect((await stored("site-a")).proposals).toEqual([]);
  });

  it("a failed business check stores nothing, so a later valid request with that key succeeds", async () => {
    const missing = await readResponse(await wait("site-b", "site-b:MAT-PUTTY", JSON.stringify({ note: "nope" }), "later-ok"));
    expect(missing.status).toBe(404);
    expect((await stored("site-b")).actions).toEqual([]);
    const created = await readResponse(await wait("site-b", "site-b:MAT-SEALANT", JSON.stringify({ note: "now" }), "later-ok"));
    expect(created.status).toBe(201);
    expect((created.body.record as { note: string }).note).toBe("now");

    const rejected = await readResponse(
      await propose("site-b", "pen-b-01", JSON.stringify({ fromInternalCode: "0438", toInternalCode: "9999", reason: "wishful" }), "later-proposal"),
    );
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe("not_a_candidate");
    expect((await stored("site-b")).proposals).toEqual([]);
    const proposed = await readResponse(
      await propose("site-b", "pen-b-01", JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: "closer rating" }), "later-proposal"),
    );
    expect(proposed.status).toBe(201);
  });
});
