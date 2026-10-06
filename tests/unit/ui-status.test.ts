import type { FitFieldCode } from "@/ui/status";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  doesNotFit,
  actionStatus,
  availabilityStatus,
  blockerReason,
  candidateStatus,
  crewStatus,
  earlierDecision,
  hasEarlierDecision,
  shortageState,
  siteChip,
  type StatusView,
} from "@/ui/status";

function expectView(actual: StatusView, expected: StatusView): void {
  expect(actual).toEqual(expected);
  expect(actual.label.length).toBeGreaterThan(0);
  expect(actual.icon.length).toBeGreaterThan(0);
}

describe("crew status", () => {
  it("maps each crew status to text, a tone, and an icon", () => {
    expectView(crewStatus("clear"), { label: "Crew can go", tone: "success", icon: "check" });
    expectView(crewStatus("blocked"), { label: "Blocked", tone: "danger", icon: "stop" });
    expectView(crewStatus("nothing_planned"), { label: "Nothing planned", tone: "neutral", icon: "dashed-circle" });
    expectView(crewStatus("unavailable"), { label: "Can't check", tone: "warning", icon: "warning" });
  });

  it("AC 9: an unavailable site is not labelled clear", () => {
    expect(crewStatus("unavailable").label).not.toBe("Crew can go");
  });
});

describe("shortage state", () => {
  it("AC 30: maps no decision yet, waiting, and escalated, including an earlier decision", () => {
    expectView(shortageState("open"), { label: "No decision yet", tone: "neutral", icon: "dashed-circle" });
    // Decisions are neither "can go" nor an alarm, and the two must be told apart at a glance.
    expectView(shortageState("waiting"), { label: "Waiting", tone: "info", icon: "clock" });
    expectView(shortageState("escalated"), { label: "Escalated", tone: "escalation", icon: "arrow-up" });
    expectView(earlierDecision(), { label: "Earlier decision, shortfall has grown", tone: "warning", icon: "warning" });
    expect(hasEarlierDecision([{ current: true }, { current: false }])).toBe(true);
    expect(hasEarlierDecision([{ current: true }])).toBe(false);
    expect(hasEarlierDecision([])).toBe(false);
  });

  it("an unknown shortage state is Unknown, never Escalated", () => {
    expect(shortageState("not-a-state")).toEqual({ label: "Unknown", tone: "neutral", icon: "dashed-circle" });
    expect(shortageState("not-a-state").label).not.toBe("Escalated");
  });
});

describe("blocker reason", () => {
  it("states each reason in plain words with the solution code", () => {
    expectView(blockerReason("unknown_solution_code", "9999"), {
      label: "Solution code 9999 isn't in the catalogue",
      tone: "danger",
      icon: "warning",
    });
    expectView(blockerReason("no_material_mapping", "0393"), {
      label: "No materials recorded for solution 0393",
      tone: "danger",
      icon: "warning",
    });
    expectView(blockerReason("invalid_quantity", "0123"), {
      label: "A material quantity is invalid for solution 0123",
      tone: "danger",
      icon: "warning",
    });
  });
});

describe("candidate status and availability", () => {
  it("maps each candidate status", () => {
    expectView(candidateStatus("ok"), {
      label: "No catalogue match for this penetration. Escalate instead.",
      tone: "neutral",
      icon: "dashed-circle",
    });
    expectView(candidateStatus("substrate_incomplete"), {
      label: "The catalogue entry for this substrate is incomplete, so we can't suggest substitutes.",
      tone: "warning",
      icon: "warning",
    });
    expectView(candidateStatus("nominated_code_unknown"), {
      label: "The nominated solution isn't in the catalogue, so we can't suggest substitutes.",
      tone: "warning",
      icon: "warning",
    });
  });

  it("maps each availability", () => {
    expectView(availabilityStatus("in_stock"), { label: "Materials in stock", tone: "success", icon: "check" });
    expectView(availabilityStatus("short"), { label: "Uses a material this site is short of.", tone: "danger", icon: "stop" });
    expectView(availabilityStatus("unknown"), { label: "No stock record for one of its materials.", tone: "warning", icon: "warning" });
    expectView(availabilityStatus("no_material_mapping"), {
      label: "We can't tell if its materials are in stock.",
      tone: "warning",
      icon: "warning",
    });
    expectView(availabilityStatus("invalid_quantity"), {
      label: "Its material quantities look invalid.",
      tone: "danger",
      icon: "warning",
    });
  });
});

describe("home chip", () => {
  it("names shortages and data problems on a blocked site, and leaves other statuses alone", () => {
    expectView(siteChip("blocked", 2, 0), { label: "Blocked · 2 shortages", tone: "danger", icon: "stop" });
    expectView(siteChip("blocked", 1, 0), { label: "Blocked · 1 shortage", tone: "danger", icon: "stop" });
    expectView(siteChip("blocked", 1, 2), { label: "Blocked · 1 shortage, 2 data problems", tone: "danger", icon: "stop" });
    expectView(siteChip("blocked", 2, 1), { label: "Blocked · 2 shortages, 1 data problem", tone: "danger", icon: "stop" });
    expectView(siteChip("blocked", 0, 2), { label: "Blocked · 2 data problems", tone: "danger", icon: "stop" });
    expectView(siteChip("blocked", 0, 1), { label: "Blocked · 1 data problem", tone: "danger", icon: "stop" });
    expectView(siteChip("blocked", 0, 0), { label: "Blocked", tone: "danger", icon: "stop" });
    expect(siteChip("clear", 2, 2)).toEqual(crewStatus("clear"));
    expect(siteChip("nothing_planned", 1, 1)).toEqual(crewStatus("nothing_planned"));
    expect(siteChip("unavailable", 1, 1)).toEqual(crewStatus("unavailable"));
    expect(siteChip("bogus", 1, 1).label).toBe("Can't check");
  });
});

describe("action status", () => {
  it("AC 15: maps current, earlier, and resolved", () => {
    expectView(actionStatus("current"), { label: "Still applies", tone: "neutral", icon: "dashed-circle" });
    expect(actionStatus("current").icon).not.toBe("check");
    expectView(actionStatus("earlier"), { label: "Shortfall has grown since", tone: "warning", icon: "warning" });
    expectView(actionStatus("resolved"), { label: "Shortage resolved", tone: "success", icon: "check" });
  });

  it("an unknown action status is Unknown, never Resolved", () => {
    expect(actionStatus("not-a-state")).toEqual({ label: "Unknown", tone: "neutral", icon: "dashed-circle" });
    expect(actionStatus("not-a-state").label).not.toBe("Resolved");
  });
});

describe("forbidden words", () => {
  it("no user-facing status string contains compatible or approved", () => {
    const labels = [
      crewStatus("clear"),
      crewStatus("blocked"),
      crewStatus("nothing_planned"),
      crewStatus("unavailable"),
      shortageState("open"),
      shortageState("waiting"),
      shortageState("escalated"),
      earlierDecision(),
      blockerReason("unknown_solution_code", "9999"),
      blockerReason("no_material_mapping", "0393"),
      blockerReason("invalid_quantity", "0123"),
      candidateStatus("ok"),
      candidateStatus("substrate_incomplete"),
      candidateStatus("nominated_code_unknown"),
      availabilityStatus("in_stock"),
      availabilityStatus("short"),
      availabilityStatus("unknown"),
      availabilityStatus("no_material_mapping"),
      availabilityStatus("invalid_quantity"),
      actionStatus("current"),
      actionStatus("earlier"),
      actionStatus("resolved"),
      siteChip("blocked", 1, 2),
      siteChip("clear", 0, 0),
    ].map((view) => view.label);
    for (const label of labels) expect(label).not.toMatch(/compatible|approved/i);
  });

  it("no file under src/ui contains compatible or approved", () => {
    const files = filesUnder("src/ui").filter((file) => /\.(ts|tsx|css)$/.test(file));
    const hits = files.filter((file) => /compatible|approved/i.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });
});

function filesUnder(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe("status icons", () => {
  it("blocked and short use a stop sign, never a cross, which reads as dismiss", async () => {
    const { readFileSync } = await import("node:fs");
    const icon = readFileSync("src/ui/Icon.tsx", "utf8");
    expect(icon).toContain('name === "stop"');
    expect(icon).not.toContain('"cross"');
    expect(readFileSync("src/ui/status.ts", "utf8")).not.toContain('"cross"');
  });
});

describe("decision icons", () => {
  it("gives wait and escalate the icon and tone of the state they create", async () => {
    const { decisionMark, shortageState: state } = await import("@/ui/status");
    expect(decisionMark("wait")).toEqual({ tone: state("waiting").tone, icon: state("waiting").icon });
    expect(decisionMark("escalate")).toEqual({ tone: state("escalated").tone, icon: state("escalated").icon });
  });

  it("puts the same icons on the Wait and Escalate buttons, which stay neutral", async () => {
    const { readFileSync } = await import("node:fs");
    const wait = readFileSync("src/ui/decisions/WaitDialog.tsx", "utf8");
    const escalate = readFileSync("src/ui/decisions/EscalateDialog.tsx", "utf8");
    expect(wait).toContain('<Icon name="clock" />');
    expect(escalate).toContain('<Icon name="arrow-up" />');
    // A logged wait or escalation shows the same mark.
    expect(readFileSync("src/ui/ActionRow.tsx", "utf8")).toContain("mark={decisionMark(decision)}");
  });
});

describe("AC 35: wording for a nominated solution that does not fit", () => {
  it("names the solution and every field that does not fit, in plain words", async () => {
    const { blockerReason, fitFieldLabel } = await import("@/ui/status");
    expect(blockerReason("solution_mismatch", "0435", ["insulation"])).toEqual({
      label: "Solution 0435 doesn't fit this penetration: insulation",
      tone: "danger",
      icon: "warning",
    });
    expect(blockerReason("solution_mismatch", "0435", ["orientation", "serviceType", "serviceSize"]).label).toBe(
      "Solution 0435 doesn't fit this penetration: orientation, service type, size",
    );
    expect(blockerReason("solution_mismatch", "0435").label).toBe("Solution 0435 doesn't fit this penetration");
    const fields: FitFieldCode[] = ["orientation", "substrate", "serviceType", "serviceSize", "integrity", "insulation"];
    expect(fields.map((field) => fitFieldLabel(field))).toEqual([
      "orientation",
      "substrate",
      "service type",
      "size",
      "integrity",
      "insulation",
    ]);
  });
});

describe("AC 36: a field that does not fit", () => {
  it("is worded with the solution's value and a stop sign, never colour alone", () => {
    expectView(doesNotFit("60 min"), { label: "60 min, doesn't fit", tone: "danger", icon: "stop" });
  });
});
