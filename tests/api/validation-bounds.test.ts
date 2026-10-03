import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getActions } from "@/app/api/sites/[id]/actions/route";
import { POST as postSubstitution } from "@/app/api/sites/[id]/penetrations/[pid]/substitutions/route";
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

function wait(body: string, key: string): Promise<Response> {
  return postWait(postRequest("http://local/wait", body, key), routeContext({ id: "site-b", shortageId: "site-b:MAT-SEALANT" }));
}

function escalate(body: string, key: string): Promise<Response> {
  return postEscalate(postRequest("http://local/escalate", body, key), routeContext({ id: "site-b", shortageId: "site-b:MAT-SEALANT" }));
}

function propose(body: string, key: string): Promise<Response> {
  return postSubstitution(postRequest("http://local/substitutions", body, key), routeContext({ id: "site-b", pid: "pen-b-01" }));
}

async function actionNotes(): Promise<(string | null)[]> {
  const result = await readResponse(await getActions(new Request("http://local/actions"), routeContext({ id: "site-b" })));
  return (result.body.actions as { note: string | null }[]).map((item) => item.note);
}

async function proposalReasons(): Promise<string[]> {
  const result = await readResponse(await getActions(new Request("http://local/actions"), routeContext({ id: "site-b" })));
  return (result.body.proposals as { reason: string }[]).map((item) => item.reason);
}

describe("reason and note limits", () => {
  it.each(["   ", "\n"])("a whitespace-only reason %j is 422 and stores nothing", async (reason) => {
    const response = await readResponse(
      await propose(JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason }), `blank-${reason.length}`),
    );
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("validation_failed");
    expect(response.text).toContain("reason");
    expect(response.text).not.toContain(reason.trim() === "" ? "   " : reason);
    expect(await proposalReasons()).toEqual([]);
  });

  it("stores a padded reason trimmed, accepts 500 characters, and rejects 501", async () => {
    const padded = await readResponse(
      await propose(JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: "  closer rating  " }), "padded-reason"),
    );
    expect(padded.status).toBe(201);
    expect((padded.body.record as { reason: string }).reason).toBe("closer rating");

    const accepted = "r".repeat(500);
    const atLimit = await readResponse(
      await propose(JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: ` ${accepted}` }), "reason-500"),
    );
    expect(atLimit.status).toBe(201);
    expect((atLimit.body.record as { reason: string }).reason).toBe(accepted);

    const marker = `LEAK${"r".repeat(497)}`;
    expect(marker).toHaveLength(501);
    const rejected = await readResponse(
      await propose(JSON.stringify({ fromInternalCode: "0438", toInternalCode: "0451", reason: marker }), "reason-501"),
    );
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe("validation_failed");
    expect(rejected.text).not.toContain("LEAK");
    expect(await proposalReasons()).toEqual([accepted, "closer rating"]);
  });

  it.each([
    ["wait", (body: string, key: string) => wait(body, key)],
    ["escalate", (body: string, key: string) => escalate(JSON.stringify({ escalateTo: "purchasing", ...JSON.parse(body) }), key)],
  ] as const)("a %s note is trimmed, 500 characters is accepted, and 501 is rejected", async (kind, send) => {
    const blank = await readResponse(await send(JSON.stringify({ note: "   " }), `${kind}-blank`));
    expect(blank.status).toBe(201);
    expect((blank.body.record as { note: string | null }).note).toBeNull();

    const newline = await readResponse(await send(JSON.stringify({ note: "\n" }), `${kind}-newline`));
    expect(newline.status).toBe(201);
    expect((newline.body.record as { note: string | null }).note).toBeNull();

    const padded = await readResponse(await send(JSON.stringify({ note: "  due Friday  " }), `${kind}-padded`));
    expect(padded.status).toBe(201);
    expect((padded.body.record as { note: string | null }).note).toBe("due Friday");

    const accepted = "n".repeat(500);
    const atLimit = await readResponse(await send(JSON.stringify({ note: ` ${accepted}` }), `${kind}-500`));
    expect(atLimit.status).toBe(201);
    expect((atLimit.body.record as { note: string | null }).note).toBe(accepted);

    const marker = `LEAK${"n".repeat(497)}`;
    const rejected = await readResponse(await send(JSON.stringify({ note: marker }), `${kind}-501`));
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe("validation_failed");
    expect(rejected.text).toContain("note");
    expect(rejected.text).not.toContain("LEAK");
    expect(await actionNotes()).toEqual([accepted, "due Friday", null, null]);
  });

  it("accepts an idempotency key of 128 characters and rejects 129", async () => {
    const accepted = await readResponse(await wait(JSON.stringify({ note: "key" }), "k".repeat(128)));
    expect(accepted.status).toBe(201);
    const rejected = await readResponse(await wait(JSON.stringify({ note: "key" }), "k".repeat(129)));
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe("idempotency_key_required");
    expect(await actionNotes()).toEqual(["key"]);
  });
});
