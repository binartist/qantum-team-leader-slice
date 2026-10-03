import { loadCatalogueFromCsv } from "@/adapters/catalogue-csv";
import { createMemoryActionsRepository } from "@/adapters/memory/actions-repository";
import { makeStubs, type StubOptions } from "@/adapters/stub";
import type { Dependencies } from "@/application";

const catalogue = loadCatalogueFromCsv();

export function testDependencies(options: StubOptions = {}): Dependencies {
  let count = 0;
  const now = (): Date => new Date("2026-10-03T12:00:00.000Z");
  const newId = (): string => `id-${++count}`;
  return {
    ...makeStubs(options),
    catalogue,
    actions: createMemoryActionsRepository({ now, newId }),
    now,
  };
}

export function routeContext<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export async function readResponse(response: Response): Promise<{ status: number; text: string; body: Record<string, unknown>; cache: string | null }> {
  const text = await response.text();
  const body = text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>);
  return { status: response.status, text, body, cache: response.headers.get("cache-control") };
}

export function postRequest(url: string, body: string, key?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (key !== undefined) headers.set("Idempotency-Key", key);
  return new Request(url, { method: "POST", headers, body });
}
