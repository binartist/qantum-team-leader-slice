import { describe, expect, it } from "vitest";
import {
  classifyActionsForList,
  deriveShortageState,
  isActionCurrent,
  viewActions,
  type Shortage,
  type ShortageAction,
  type ShortageLookup,
} from "@/domain";

function action(partial: Partial<ShortageAction> & Pick<ShortageAction, "id" | "createdAt" | "kind">): ShortageAction {
  return {
    siteId: "site-a",
    shortageId: "site-a:M",
    escalateTo: null,
    note: null,
    shortfallQtyAtTime: 5,
    createdBy: "leader",
    ...partial,
  };
}

function shortage(partial: Partial<Shortage> & Pick<Shortage, "id" | "shortfallQty">): Shortage {
  return {
    siteId: "site-a",
    materialId: "M",
    kind: partial.shortfallQty === null ? "unknown" : "short",
    requiredQty: 10,
    onHandQty: partial.shortfallQty === null ? null : 5,
    penetrationIds: ["p1"],
    state: "open",
    actions: [],
    ...partial,
  };
}

describe("isActionCurrent", () => {
  it("AC 15: an action recorded at shortfall 5 is earlier when shortfall is 8", () => {
    expect(isActionCurrent(action({ id: "a", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait" }), 8)).toBe(false);
  });

  it("is current when the shortfall is unchanged or smaller", () => {
    const recorded = action({ id: "a", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait" });
    expect(isActionCurrent(recorded, 5)).toBe(true);
    expect(isActionCurrent(recorded, 4)).toBe(true);
  });

  it("AC 15: is not current at the recorded shortfall plus one", () => {
    const recorded = action({ id: "a", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait", shortfallQtyAtTime: 5 });
    expect(isActionCurrent(recorded, 6)).toBe(false);
  });

  it("AC 15: an unknown-stock action is current only while the shortfall is still unknown", () => {
    const recorded = action({
      id: "a",
      createdAt: "2026-10-01T00:00:00.000Z",
      kind: "wait",
      shortfallQtyAtTime: null,
    });
    expect(isActionCurrent(recorded, null)).toBe(true);
    expect(isActionCurrent(recorded, 8)).toBe(false);
    expect(isActionCurrent(action({ id: "b", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait" }), null)).toBe(false);
  });
});

describe("deriveShortageState", () => {
  const at = "2026-10-01T00:00:00.000Z";

  it("AC 14: escalate then wait stays escalated", () => {
    const state = deriveShortageState([
      { ...action({ id: "wait", createdAt: "2026-10-02T00:00:00.000Z", kind: "wait" }), current: true },
      {
        ...action({ id: "escalate", createdAt: at, kind: "escalate", escalateTo: "purchasing" }),
        current: true,
      },
    ]);
    expect(state).toBe("escalated");
  });

  it("is waiting when the only current action is wait", () => {
    expect(
      deriveShortageState([
        { ...action({ id: "wait", createdAt: "2026-10-02T00:00:00.000Z", kind: "wait" }), current: true },
        {
          ...action({ id: "old", createdAt: at, kind: "escalate", escalateTo: "warehouse" }),
          current: false,
        },
      ]),
    ).toBe("waiting");
  });

  it("AC 15: is open when no action is current", () => {
    expect(
      deriveShortageState([
        { ...action({ id: "old", createdAt: at, kind: "escalate", escalateTo: "purchasing" }), current: false },
      ]),
    ).toBe("open");
    expect(deriveShortageState([])).toBe("open");
  });
});

describe("viewActions", () => {
  it("lists newest first and keeps input order when createdAt ties", () => {
    const first = action({ id: "first", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait" });
    const tiedA = action({ id: "tied-a", createdAt: "2026-10-03T00:00:00.000Z", kind: "wait", note: "a" });
    const tiedB = action({ id: "tied-b", createdAt: "2026-10-03T00:00:00.000Z", kind: "escalate", escalateTo: "warehouse" });
    const input = [first, tiedA, tiedB];
    Object.freeze(input);
    Object.freeze(first);
    const views = viewActions(input, 5);
    expect(views.map((item) => item.id)).toEqual(["tied-a", "tied-b", "first"]);
    expect(views.every((item) => item.current)).toBe(true);
    expect(input.map((item) => item.id)).toEqual(["first", "tied-a", "tied-b"]);
    expect("current" in first).toBe(false);
  });

  it("AC 15: marks an action recorded at 5 as not current when the shortfall is 8", () => {
    const views = viewActions([action({ id: "a", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait" })], 8);
    expect(views[0]?.current).toBe(false);
  });
});

describe("classifyActionsForList", () => {
  it("AC 15: gives resolved when no current shortage has that id, otherwise current or earlier, newest first", () => {
    const resolved = action({
      id: "resolved",
      createdAt: "2026-10-04T00:00:00.000Z",
      kind: "wait",
      shortageId: "site-a:gone",
    });
    const earlier = action({ id: "earlier", createdAt: "2026-10-03T00:00:00.000Z", kind: "escalate", escalateTo: "purchasing" });
    const current = action({
      id: "current",
      createdAt: "2026-10-02T00:00:00.000Z",
      kind: "wait",
      shortfallQtyAtTime: 8,
    });
    const listed = classifyActionsForList([current, resolved, earlier], [shortage({ id: "site-a:M", shortfallQty: 8 })]);
    expect(listed.map((item) => ({ id: item.id, status: item.status }))).toEqual([
      { id: "resolved", status: "resolved" },
      { id: "earlier", status: "earlier" },
      { id: "current", status: "current" },
    ]);
  });

  it("orders mixed timestamp formats newest first and keeps equal and unparseable timestamps in input order", () => {
    const whole = action({ id: "whole", createdAt: "2026-10-03T00:00:00Z", kind: "wait" });
    const millis = action({ id: "millis", createdAt: "2026-10-03T00:00:00.001Z", kind: "wait" });
    const plus2 = action({ id: "plus2", createdAt: "2026-10-03T12:00:00.000+02:00", kind: "wait" });
    const utc11 = action({ id: "utc11", createdAt: "2026-10-03T11:00:00.000Z", kind: "escalate", escalateTo: "purchasing" });
    expect(viewActions([whole, millis], 5).map((item) => item.id)).toEqual(["millis", "whole"]);
    expect(viewActions([plus2, utc11], 5).map((item) => item.id)).toEqual(["utc11", "plus2"]);

    const tiedA = action({ id: "tied-a", createdAt: "2026-10-03T10:00:00.000Z", kind: "wait" });
    const tiedB = action({ id: "tied-b", createdAt: "2026-10-03T12:00:00.000+02:00", kind: "wait" });
    expect(viewActions([tiedA, tiedB], 5).map((item) => item.id)).toEqual(["tied-a", "tied-b"]);
    expect(classifyActionsForList([tiedA, tiedB], [shortage({ id: "site-a:M", shortfallQty: 5 })]).map((item) => item.id)).toEqual([
      "tied-a",
      "tied-b",
    ]);

    const bad = action({ id: "bad", createdAt: "not-a-timestamp", kind: "wait" });
    const later = action({ id: "later", createdAt: "2026-10-03T00:00:00.000Z", kind: "wait" });
    expect(viewActions([bad, later], 5).map((item) => item.id)).toEqual(["bad", "later"]);
    expect(viewActions([later, bad], 5).map((item) => item.id)).toEqual(["later", "bad"]);
  });

  it("AC 15: classifies a known-shortfall action as earlier when the shortage is unknown", () => {
    const recorded = action({
      id: "was-known",
      createdAt: "2026-10-01T00:00:00.000Z",
      kind: "escalate",
      escalateTo: "purchasing",
      shortfallQtyAtTime: 5,
    });
    const listed = classifyActionsForList([recorded], [shortage({ id: "site-a:M", shortfallQty: null, kind: "unknown" })]);
    expect(listed[0]?.status).toBe("earlier");
  });

  it("does not reorder or mutate a frozen array and ignores another site", () => {
    const first = action({ id: "first", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait" });
    const second = action({ id: "second", createdAt: "2026-10-02T00:00:00.000Z", kind: "wait" });
    const foreign = action({
      id: "foreign",
      createdAt: "2026-10-03T00:00:00.000Z",
      kind: "escalate",
      escalateTo: "purchasing",
      siteId: "site-b",
      shortageId: "site-a:M",
      shortfallQtyAtTime: 5,
    });
    const input = [first, second, foreign];
    Object.freeze(input);
    const listed = classifyActionsForList(input, [shortage({ id: "site-a:M", shortfallQty: 5, siteId: "site-a" })]);
    expect(input.map((item) => item.id)).toEqual(["first", "second", "foreign"]);
    expect(listed.map((item) => ({ id: item.id, status: item.status }))).toEqual([
      { id: "foreign", status: "resolved" },
      { id: "second", status: "current" },
      { id: "first", status: "current" },
    ]);
  });

  it("treats an unknown shortage as current only for an action recorded with a null shortfall", () => {
    const recorded = action({
      id: "unknown",
      createdAt: "2026-10-01T00:00:00.000Z",
      kind: "wait",
      shortfallQtyAtTime: null,
    });
    const listed = classifyActionsForList([recorded], [shortage({ id: "site-a:M", shortfallQty: null, kind: "unknown" })]);
    expect(listed[0]?.status).toBe("current");
  });

  it("treats a blocker lookup with a null shortfall as current", () => {
    const recorded = action({
      id: "blocker-escalation",
      createdAt: "2026-10-02T00:00:00.000Z",
      kind: "escalate",
      escalateTo: "purchasing",
      shortageId: "site-a:blocker.p1",
      shortfallQtyAtTime: null,
    });
    const blocker: ShortageLookup = { id: "site-a:blocker.p1", siteId: "site-a", shortfallQty: null };
    const listed = classifyActionsForList([recorded], [blocker]);
    expect(listed[0]?.status).toBe("current");
  });
});
