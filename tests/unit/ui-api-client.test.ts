import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Client = typeof import("@/ui/decisions/api-client");

let client: Client;
const storage = new Map<string, string>();

beforeEach(async () => {
  storage.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  vi.stubGlobal("window", {
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
    dispatchEvent: () => true,
    fetch: vi.fn(),
  });
  vi.resetModules();
  client = await import("@/ui/decisions/api-client");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("postDecision", () => {
  it("returns success for 201 and replay for 200 with created false", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { id: "row-1", message: "stored" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(client.postDecision("/api/sites/site-b/shortages/site-b:MAT-SEALANT/wait", "key-1", {})).resolves.toEqual({
      ok: true,
      replay: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sites/site-b/shortages/site-b:MAT-SEALANT/wait",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "idempotency-key": "key-1" }),
      }),
    );

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { created: false, message: "already" })));
    await expect(client.postDecision("/api/x", "key-1", {})).resolves.toEqual({ ok: true, replay: true });
    expect(client.getAnnouncement()).toBe("");
  });

  it("maps 409 stale_nomination and 422 validation_failed without the server message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(409, { code: "stale_nomination", message: "Nomination changed." })));
    await expect(client.postDecision("/api/x", "key-1", {})).resolves.toEqual({ ok: false, code: "stale_nomination" });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(422, { code: "validation_failed", message: "reason is required" })));
    const result = await client.postDecision("/api/x", "key-1", {});
    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(JSON.stringify(result)).not.toContain("reason is required");
  });

  it("collapses a non-JSON body and an unsafe code to internal_error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>secret path</html>", { status: 500 })));
    const html = await client.postDecision("/api/x", "key-1", {});
    expect(html).toEqual({ ok: false, code: "internal_error" });
    expect(JSON.stringify(html)).not.toContain("secret");

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { code: "<script>alert(1)</script>", message: "nope" })));
    const unsafe = await client.postDecision("/api/x", "key-1", {});
    expect(unsafe).toEqual({ ok: false, code: "internal_error" });
    expect(JSON.stringify(unsafe)).not.toContain("script");
  });

  it("a rejected fetch is a transport failure and does not announce success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));
    await expect(client.postDecision("/api/x", "key-1", {})).resolves.toEqual({ ok: false, code: "transport_failed" });
    expect(client.getAnnouncement()).toBe("");
  });
});

describe("announcements", () => {
  it("starts empty on a new load even when sessionStorage holds the last success", () => {
    storage.set("team-leader:announce", "Escalation recorded");
    expect(client.getAnnouncement()).toBe("");
    expect(client.getServerAnnouncement()).toBe("");
    expect("ANNOUNCE_EVENT" in client).toBe(false);
  });

  it("publishes from memory and does not write sessionStorage", () => {
    const seen: string[] = [];
    const unsubscribe = client.subscribeAnnouncements(() => seen.push(client.getAnnouncement()));
    client.announce("Wait recorded");
    unsubscribe();
    expect(client.getAnnouncement()).toBe("Wait recorded");
    expect(seen).toContain("Wait recorded");
    expect(storage.size).toBe(0);
  });
});

describe("replay announcer", () => {
  it("announces Already recorded only for an API 200 with created false", async () => {
    const original = vi.fn(async () => jsonResponse(200, { created: false }));
    window.fetch = original;
    const restore = client.installReplayAnnouncer();
    await window.fetch("/api/sites/site-b/shortages/x/wait", { method: "POST" });
    await vi.waitFor(() => expect(client.getAnnouncement()).toBe("Already recorded"));
    restore();
    expect(window.fetch).toBe(original);
  });

  it("does not announce for a non-replay, a non-API call, or a non-JSON body", async () => {
    window.fetch = vi.fn(async () => jsonResponse(201, { created: true }));
    const restore = client.installReplayAnnouncer();
    await window.fetch("/api/sites/site-b/shortages/x/wait", { method: "POST" });
    await window.fetch("/other", { method: "POST" });
    await window.fetch(new URL("http://127.0.0.1/api/sites/site-b/actions"), { method: "POST" });
    await window.fetch(new Request("http://127.0.0.1/api/sites/site-b/actions", { method: "POST" }));
    await window.fetch("/api/sites/site-b/actions");
    window.fetch = vi.fn(async () => new Response("not-json", { status: 200 }));
    const restoreAgain = client.installReplayAnnouncer();
    await window.fetch("/api/sites/site-b/shortages/x/wait", { method: "POST" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.getAnnouncement()).toBe("");
    restore();
    restoreAgain();
  });
});

describe("decision urls", () => {
  it("encodes site, shortage, and penetration ids", () => {
    expect(client.shortageActionUrl("a/b", "c d", "wait")).toBe("/api/sites/a%2Fb/shortages/c%20d/wait");
    expect(client.substitutionUrl("a/b", "c d")).toBe("/api/sites/a%2Fb/penetrations/c%20d/substitutions");
  });
});
