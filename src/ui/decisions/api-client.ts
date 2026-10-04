import { ANNOUNCE } from "../messages";

const SAFE_CODE = /^[a-z0-9_]{1,80}$/;

type Notice = { text: string; id: number };
let current: Notice = { text: "", id: 0 };
const listeners = new Set<() => void>();

export function subscribeAnnouncements(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAnnouncement(): string {
  return current.text;
}

export function getServerAnnouncement(): string {
  return "";
}

export type DecisionResult = { readonly ok: true; readonly replay: boolean } | { readonly ok: false; readonly code: string };

export function announce(text: string): void {
  publish("");
  window.setTimeout(() => publish(text), 30);
}

export function installReplayAnnouncer(): () => void {
  const original = window.fetch;
  const call = original.bind(window);
  const wrapped: typeof window.fetch = async (input, init) => {
    const response = await call(input, init);
    void noticeReplay(input, init, response);
    return response;
  };
  window.fetch = wrapped;
  return () => {
    if (window.fetch === wrapped) window.fetch = original;
  };
}

export function shortageActionUrl(siteId: string, shortageId: string, action: "wait" | "escalate"): string {
  return `/api/sites/${encodeURIComponent(siteId)}/shortages/${encodeURIComponent(shortageId)}/${action}`;
}

export function substitutionUrl(siteId: string, penetrationId: string): string {
  return `/api/sites/${encodeURIComponent(siteId)}/penetrations/${encodeURIComponent(penetrationId)}/substitutions`;
}

export async function postDecision(url: string, key: string, body: unknown): Promise<DecisionResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "transport_failed" };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 201) return { ok: true, replay: false };
  if (response.status === 200 && createdFalse(payload)) return { ok: true, replay: true };
  return { ok: false, code: readCode(payload) };
}

async function noticeReplay(input: RequestInfo | URL, init: RequestInit | undefined, response: Response): Promise<void> {
  if (requestMethod(input, init) !== "POST" || !requestUrl(input).includes("/api/") || response.status !== 200) return;
  try {
    const payload: unknown = await response.clone().json();
    if (createdFalse(payload)) announce(ANNOUNCE.replay);
  } catch {
    // A non-JSON body is not a replay we can describe.
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init: RequestInit | undefined): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function createdFalse(payload: unknown): boolean {
  return isRecord(payload) && payload.created === false;
}

function readCode(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.code !== "string" || !SAFE_CODE.test(payload.code)) return "internal_error";
  return payload.code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function publish(text: string): void {
  current = { text, id: current.id + 1 };
  for (const listener of listeners) listener();
}
