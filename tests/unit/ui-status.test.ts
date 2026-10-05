import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  actionStatus,
  availabilityStatus,
  blockerReason,
  candidateStatus,
  crewStatus,
  earlierDecision,
  hasEarlierDecision,
  ratingComparison,
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
    expectView(crewStatus("blocked"), { label: "Blocked", tone: "danger", icon: "cross" });
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
    expectView(shortageState("waiting"), { label: "Waiting", tone: "warning", icon: "warning" });
    expectView(shortageState("escalated"), { label: "Escalated", tone: "warning", icon: "warning" });
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
    expectView(availabilityStatus("short"), { label: "Uses a material this site is short of.", tone: "danger", icon: "cross" });
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
    expectView(siteChip("blocked", 2, 0), { label: "Blocked · 2 shortages", tone: "danger", icon: "cross" });
    expectView(siteChip("blocked", 1, 0), { label: "Blocked · 1 shortage", tone: "danger", icon: "cross" });
    expectView(siteChip("blocked", 1, 2), { label: "Blocked · 1 shortage, 2 data problems", tone: "danger", icon: "cross" });
    expectView(siteChip("blocked", 2, 1), { label: "Blocked · 2 shortages, 1 data problem", tone: "danger", icon: "cross" });
    expectView(siteChip("blocked", 0, 2), { label: "Blocked · 2 data problems", tone: "danger", icon: "cross" });
    expectView(siteChip("blocked", 0, 1), { label: "Blocked · 1 data problem", tone: "danger", icon: "cross" });
    expectView(siteChip("blocked", 0, 0), { label: "Blocked", tone: "danger", icon: "cross" });
    expect(siteChip("clear", 2, 2)).toEqual(crewStatus("clear"));
    expect(siteChip("nothing_planned", 1, 1)).toEqual(crewStatus("nothing_planned"));
    expect(siteChip("unavailable", 1, 1)).toEqual(crewStatus("unavailable"));
    expect(siteChip("bogus", 1, 1).label).toBe("Can't check");
  });
});

describe("rating comparison", () => {
  const meets: StatusView = { label: "Meets the required rating", tone: "success", icon: "check" };
  const below: StatusView = { label: "Below the required rating", tone: "warning", icon: "warning" };

  it("meets when both candidate minutes cover the requirement, and a null requirement is met by anything", () => {
    expectView(ratingComparison(60, 30, 60, 30), meets);
    expectView(ratingComparison(60, 60, 60, 30), meets);
    expectView(ratingComparison(120, 90, 60, 30), meets);
    expectView(ratingComparison(null, null, null, null), meets);
    expectView(ratingComparison(null, 30, null, 30), meets);
    expectView(ratingComparison(60, null, 60, null), meets);
    expectView(ratingComparison(0, 0, null, null), meets);
  });

  it("is below when a candidate minute misses a stated requirement, including a null or non-finite minute", () => {
    expectView(ratingComparison(59, 30, 60, 30), below);
    expectView(ratingComparison(60, 29, 60, 30), below);
    expectView(ratingComparison(null, null, 60, null), below);
    expectView(ratingComparison(60, null, 60, 30), below);
    expectView(ratingComparison(null, 90, 60, 30), below);
    expectView(ratingComparison(Number.NaN, 30, 60, 30), below);
    expectView(ratingComparison(60, Number.POSITIVE_INFINITY, 60, 30), below);
    expectView(ratingComparison(60, 30, Number.NaN, 30), below);
    expect(below.label).not.toMatch(/compatible|approved/i);
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
      ratingComparison(60, 60, 60, 30),
      ratingComparison(30, 30, 60, 60),
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
