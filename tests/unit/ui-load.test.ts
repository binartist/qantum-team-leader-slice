import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, PenetrationNotFoundError, ShortageNotFoundError, UpstreamError, ValidationFailedError } from "@/ports";

const connection = vi.hoisted(() => vi.fn(async () => undefined));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/server", () => ({ connection }));
vi.mock("next/navigation", () => ({ notFound }));

import { loadPage } from "@/app/_lib/load";

beforeEach(() => {
  connection.mockClear();
  notFound.mockClear();
});

describe("loadPage", () => {
  it("returns the value when the use case succeeds", async () => {
    await expect(loadPage(async () => ({ crewStatus: "clear" as const }))).resolves.toEqual({
      status: "ready",
      value: { crewStatus: "clear" },
    });
    expect(connection).toHaveBeenCalledOnce();
  });

  it("AC 9: an upstream failure is unavailable and never a ready clear page", async () => {
    const result = await loadPage(async () => {
      throw new UpstreamError("upstream_unavailable", "stock");
    });
    expect(result).toEqual({ status: "unavailable" });
    expect(notFound).not.toHaveBeenCalled();
    expect(connection).toHaveBeenCalled();
  });

  it("AC 9: malformed upstream data is unavailable and still calls connection", async () => {
    const result = await loadPage(async () => {
      throw new UpstreamError("upstream_invalid", "stock");
    });
    expect(result).toEqual({ status: "unavailable" });
    expect(connection).toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound for an AppError 404 and rethrows anything else", async () => {
    await expect(
      loadPage(async () => {
        throw new AppError(404, "site_not_found", "Site not found.");
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();

    notFound.mockClear();
    await expect(
      loadPage(async () => {
        throw new PenetrationNotFoundError();
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      loadPage(async () => {
        throw new ShortageNotFoundError();
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);

    await expect(
      loadPage(async () => {
        throw new ValidationFailedError(["reason"]);
      }),
    ).rejects.toBeInstanceOf(ValidationFailedError);

    await expect(
      loadPage(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
