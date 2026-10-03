import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postWait } from "@/app/api/sites/[id]/shortages/[shortageId]/wait/route";
import { PayloadTooLargeError } from "@/ports";
import { setDependenciesForTests } from "@/server/deps";
import { readJsonBody } from "@/server/http";
import { readResponse, routeContext, testDependencies } from "./support";

beforeEach(() => {
  setDependenciesForTests(testDependencies());
});

afterEach(() => {
  setDependenciesForTests(null);
});

function countingStream(chunkCount: number, chunkSize: number, pulls: { n: number }, fill = 0x78): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      pulls.n += 1;
      if (sent >= chunkCount) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(chunkSize).fill(fill));
      sent += 1;
    },
  });
}

function streamRequest(stream: ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    body: stream,
    duplex: "half",
    headers,
  };
  return new Request("http://local/wait", init);
}

const exactBody = `${JSON.stringify({ note: "ok" })}${" ".repeat(10_000 - JSON.stringify({ note: "ok" }).length)}`;

describe("AC 17: request body limit", () => {
  it("accepts exactly 10000 bytes and rejects 10001", async () => {
    expect(new TextEncoder().encode(exactBody).length).toBe(10_000);
    const accepted = await readJsonBody(new Request("http://local/wait", { method: "POST", body: exactBody }));
    expect(accepted).toEqual({ note: "ok" });

    const route = await readResponse(
      await postWait(
        new Request("http://local/wait", {
          method: "POST",
          body: exactBody,
          headers: { "idempotency-key": "exact-body", "content-type": "application/json" },
        }),
        routeContext({ id: "site-b", shortageId: "site-b:MAT-SEALANT" }),
      ),
    );
    expect(route.status).toBe(201);

    await expect(readJsonBody(new Request("http://local/wait", { method: "POST", body: `${exactBody} ` }))).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
    const tooBig = await readResponse(
      await postWait(
        new Request("http://local/wait", {
          method: "POST",
          body: `${exactBody} `,
          headers: { "idempotency-key": "over-body", "content-type": "application/json" },
        }),
        routeContext({ id: "site-b", shortageId: "site-b:MAT-SEALANT" }),
      ),
    );
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.code).toBe("payload_too_large");
  });

  it.each([
    ["missing", undefined],
    ["non-numeric", "10, 20"],
    ["understated", "10"],
  ] as const)("a %s Content-Length stops once the stream passes 10000 bytes", async (_label, contentLength) => {
    const pulls = { n: 0 };
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (contentLength !== undefined) headers["content-length"] = contentLength;
    const request = streamRequest(countingStream(30, 1000, pulls), headers);
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(pulls.n).toBeLessThan(30);
  });

  it("rejects a numeric Content-Length above the limit before reading the stream", async () => {
    const pulls = { n: 0 };
    const request = streamRequest(countingStream(20, 1000, pulls), { "content-length": "10001" });
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(pulls.n).toBeLessThan(20);
  });

  it("the wait route stops an understated stream at the limit", async () => {
    const pulls = { n: 0 };
    const response = await readResponse(
      await postWait(
        streamRequest(countingStream(30, 1000, pulls), {
          "content-length": "10",
          "content-type": "application/json",
          "idempotency-key": "stream-limit",
        }),
        routeContext({ id: "site-b", shortageId: "site-b:MAT-SEALANT" }),
      ),
    );
    expect(response.status).toBe(413);
    expect(response.body.code).toBe("payload_too_large");
    expect(pulls.n).toBeLessThan(30);
  });
});
