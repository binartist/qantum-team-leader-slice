import { describe, expect, it } from "vitest";
import { materialLog, uncheckedMaterialActions, type MaterialLogSection } from "@/ui/material-log";

function action(
  id: string,
  shortageId: string,
  createdAt: string,
  overrides: {
    kind?: "wait" | "escalate";
    escalateTo?: "purchasing" | "warehouse" | null;
    note?: string | null;
    status?: "current" | "earlier" | "resolved";
    createdBy?: string;
  } = {},
) {
  return {
    id,
    shortageId,
    kind: overrides.kind ?? "escalate",
    escalateTo: overrides.escalateTo === undefined ? "purchasing" : overrides.escalateTo,
    note: overrides.note === undefined ? null : overrides.note,
    createdBy: overrides.createdBy ?? "demo-leader",
    createdAt,
    status: overrides.status ?? "current",
  };
}

const sealant = { "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge" } };

function ready(siteId: string, siteName: string, actions: ReturnType<typeof action>[]): MaterialLogSection {
  return { status: "ready", siteId, siteName, listed: { actions, materials: sealant, penetrations: {} } };
}

describe("AC 46: a material's log", () => {
  it("has every site's decisions on its shortage, newest first, and names the sites it could not check", () => {
    const sections: MaterialLogSection[] = [
      ready("site-a", "Alpha Works", [
        action("a-late", "site-a:MAT-SEALANT", "2026-10-04T00:00:00.000Z", { note: "Order more" }),
        action("a-tie", "site-a:MAT-SEALANT", "2026-10-02T00:00:00.000Z", { kind: "wait", escalateTo: null, createdBy: "ada" }),
        action("a-other", "site-a:MAT-OTHER", "2026-10-09T00:00:00.000Z"),
        action("a-blocker", "site-a:blocker.pen-1", "2026-10-08T00:00:00.000Z"),
        action("a-bare", "MAT-SEALANT", "2026-10-07T00:00:00.000Z"),
      ]),
      ready("site-b", "Beta Point", [
        action("b-tie", "site-b:MAT-SEALANT", "2026-10-02T00:00:00.000Z", { status: "earlier" }),
        action("b-mid", "site-b:MAT-SEALANT", "2026-10-03T00:00:00.000Z"),
      ]),
      { status: "unavailable", siteId: "site-c", siteName: "Gamma Yard" },
      ready("site-d", "Delta", [action("d-other", "site-d:MAT-COLLAR-25", "2026-10-01T00:00:00.000Z")]),
    ];

    const log = materialLog(sections, "MAT-SEALANT");
    expect(log.uncheckedSites).toEqual(["Gamma Yard"]);
    expect(log.entries.map((entry) => entry.id)).toEqual(["a-late", "b-mid", "a-tie", "b-tie"]);
    expect(log.entries.map((entry) => entry.at)).toEqual(["At Alpha Works", "At Beta Point", "At Alpha Works", "At Beta Point"]);
    const first = log.entries[0];
    const waited = log.entries[2];
    const tied = log.entries[3];
    if (!first || !waited || !tied) throw new Error("expected four entries");
    expect(first).toMatchObject({
      sentence: "Escalated to purchasing: Intumescent sealant, 310 ml cartridge",
      note: "Order more",
      createdBy: "demo-leader",
      status: "current",
      decision: "escalate",
      siteName: "Alpha Works",
    });
    expect(waited).toMatchObject({
      sentence: "Wait: Intumescent sealant, 310 ml cartridge",
      decision: "wait",
      createdBy: "ada",
      note: null,
    });
    expect(tied.status).toBe("earlier");

    const tiedAgain = materialLog(
      [
        ready("site-a", "Alpha Works", [action("first", "site-a:MAT-SEALANT", "2026-10-02T00:00:00.000Z")]),
        ready("site-b", "Beta Point", [action("second", "site-b:MAT-SEALANT", "2026-10-02T00:00:00.000Z")]),
      ],
      "MAT-SEALANT",
    );
    expect(tiedAgain.entries.map((entry) => entry.id)).toEqual(["first", "second"]);
    expect(tiedAgain.uncheckedSites).toEqual([]);

    const unreadable = materialLog(
      [
        ready("site-a", "Alpha Works", [action("bad-date", "site-a:MAT-SEALANT", "not-a-date")]),
        ready("site-b", "Beta Point", [action("later", "site-b:MAT-SEALANT", "2026-10-08T00:00:00.000Z")]),
      ],
      "MAT-SEALANT",
    );
    expect(unreadable.entries.map((entry) => entry.id)).toEqual(["bad-date", "later"]);
  });

  it("pluralises the warning for the sites whose actions could not be read", () => {
    expect(uncheckedMaterialActions(1)).toBe("We can't check 1 site's actions right now. Its decisions are not listed.");
    expect(uncheckedMaterialActions(2)).toBe("We can't check 2 sites' actions right now. Their decisions are not listed.");
  });
});
