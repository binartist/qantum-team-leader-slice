import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppError, UpstreamError } from "@/ports";

export type PageLoad<T> = { readonly status: "ready"; readonly value: T } | { readonly status: "unavailable" };

/** Maps a use-case call onto a page state. Upstream failure is unavailable, never clear. */
export async function loadPage<T>(work: () => Promise<T>): Promise<PageLoad<T>> {
  await connection();
  try {
    return { status: "ready", value: await work() };
  } catch (error) {
    if (error instanceof UpstreamError) return { status: "unavailable" };
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
