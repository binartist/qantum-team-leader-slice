import { describe, expect, it } from "vitest";
import { dialogFieldError, dialogFormError, escalateDestination, noteProblem, reasonProblem, sendOutcome } from "@/ui/decisions/form";

describe("dialog field checks", () => {
  it("rejects an empty reason and a trimmed note or reason over 500", () => {
    expect(reasonProblem("")).toBe("Give a reason.");
    expect(reasonProblem("   ")).toBe("Give a reason.");
    expect(reasonProblem("ok")).toBe("");
    expect(reasonProblem(` ${"x".repeat(500)} `)).toBe("");
    expect(reasonProblem("x".repeat(501))).toBe("That's too long. Shorten it.");
    expect(noteProblem("")).toBe("");
    expect(noteProblem(` ${"x".repeat(500)}`)).toBe("");
    expect(noteProblem("x".repeat(501))).toBe("That's too long. Shorten it.");
  });

  it("coerces the escalate destination and splits field errors from form errors", () => {
    expect(escalateDestination("warehouse")).toBe("warehouse");
    expect(escalateDestination("purchasing")).toBe("purchasing");
    expect(escalateDestination("elsewhere")).toBe("purchasing");
    expect(dialogFieldError("validation_failed")).toBe("Check the highlighted fields.");
    expect(dialogFieldError("stale_nomination")).toBe("");
    expect(dialogFieldError("")).toBe("");
    expect(dialogFormError("validation_failed")).toBe("");
    expect(dialogFormError("")).toBe("");
    expect(dialogFormError("stale_nomination")).toBe("This penetration's nomination has changed. Refresh and try again.");
    expect(dialogFormError("transport_failed")).toBe(
      "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice.",
    );
    expect(dialogFormError("not_a_code")).toBe("Something went wrong. Nothing was recorded.");
  });
});

describe("send outcome", () => {
  it("never announces or refreshes a failure, and still does both when the dialog has closed", () => {
    expect(sendOutcome({ ok: false, code: "transport_failed" }, true)).toEqual({
      announceSuccess: false,
      refresh: false,
      formError: "transport_failed",
      close: false,
    });
    expect(sendOutcome({ ok: false, code: "stale_nomination" }, false)).toEqual({
      announceSuccess: false,
      refresh: false,
      formError: "",
      close: false,
    });
    expect(sendOutcome({ ok: true, replay: false }, true)).toEqual({
      announceSuccess: true,
      refresh: true,
      formError: "",
      close: true,
    });
    expect(sendOutcome({ ok: true, replay: false }, false)).toEqual({
      announceSuccess: true,
      refresh: true,
      formError: "",
      close: false,
    });
    expect(sendOutcome({ ok: true, replay: true }, false)).toEqual({
      announceSuccess: false,
      refresh: true,
      formError: "",
      close: false,
    });
  });
});
