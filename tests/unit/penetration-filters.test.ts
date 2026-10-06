import { describe, expect, it } from "vitest";
import {
  filterCounts,
  logIsOpen,
  matchingPenetrations,
  materialValues,
  parseShow,
  penetrationMatches,
  showFilterHref,
} from "@/ui/penetration-filters";

const places = [{ id: "short-one" }, { id: "problem" }, { id: "both" }, { id: "plain" }];

const shortages = [
  { state: "open", penetrationIds: ["short-one"] },
  { state: "escalated", penetrationIds: ["both"] },
  { state: "waiting", penetrationIds: ["waited-only"] },
];

const blockers = [
  { penetrationId: "problem", state: "waiting" },
  { penetrationId: "both", state: "open" },
];

describe("penetration filters", () => {
  it("keeps known chips in page order and drops anything else", () => {
    expect(parseShow(undefined)).toEqual([]);
    expect(parseShow("shortages")).toEqual(["shortages"]);
    expect(parseShow(["waited", "nope", "shortages", "escalated", "acted"])).toEqual(["shortages", "acted"]);
    expect(parseShow("clear")).toEqual([]);
  });

  it("reads material values and whether the log should open", () => {
    expect(materialValues(undefined)).toEqual([]);
    expect(materialValues("MAT-SEALANT")).toEqual(["MAT-SEALANT"]);
    expect(materialValues(["MAT-A", "MAT-B"])).toEqual(["MAT-A", "MAT-B"]);
    expect(logIsOpen(undefined)).toBe(false);
    expect(logIsOpen("open")).toBe(true);
    expect(logIsOpen("closed")).toBe(false);
    expect(logIsOpen(["closed", "open"])).toBe(true);
  });

  it("matches shortages, including unknown stock, and data problems", () => {
    expect(penetrationMatches("short-one", "shortages", shortages, blockers)).toBe(true);
    expect(penetrationMatches("plain", "shortages", shortages, blockers)).toBe(false);
    expect(penetrationMatches("problem", "data-problems", shortages, blockers)).toBe(true);
    expect(penetrationMatches("short-one", "data-problems", shortages, blockers)).toBe(false);
  });

  it("matches a wait or an escalation, from a shortage or from that penetration's data problem, once", () => {
    expect(penetrationMatches("both", "acted", shortages, blockers)).toBe(true);
    expect(penetrationMatches("problem", "acted", shortages, blockers)).toBe(true);
    expect(penetrationMatches("waited-only", "acted", shortages, blockers)).toBe(true);
    expect(penetrationMatches("short-one", "acted", shortages, blockers)).toBe(false);
    expect(penetrationMatches("both", "acted", [{ state: "open", penetrationIds: ["both"] }], [{ penetrationId: "both", state: "escalated" }])).toBe(
      true,
    );
    expect(
      filterCounts([{ id: "double" }], [{ state: "escalated", penetrationIds: ["double"] }], [{ penetrationId: "double", state: "waiting" }]),
    ).toEqual({ shortages: 1, "data-problems": 1, acted: 1 });
  });

  it("returns every penetration until a chip is selected, then the union", () => {
    expect(matchingPenetrations(places, [], shortages, blockers)).toBe(places);
    expect(matchingPenetrations(places, ["shortages", "data-problems"], shortages, blockers).map((place) => place.id)).toEqual([
      "short-one",
      "problem",
      "both",
    ]);
    expect(matchingPenetrations(places, ["acted"], shortages, blockers).map((place) => place.id)).toEqual(["problem", "both"]);
  });

  it("counts each chip across the whole list, including zero", () => {
    expect(filterCounts(places, shortages, blockers)).toEqual({
      shortages: 2,
      "data-problems": 2,
      acted: 2,
    });
    expect(filterCounts([], shortages, blockers)).toEqual({ shortages: 0, "data-problems": 0, acted: 0 });
  });

  it("toggles one chip and keeps the material filter", () => {
    expect(showFilterHref("site-b", [], "shortages")).toBe("/sites/site-b?show=shortages");
    expect(showFilterHref("site-b", ["shortages", "acted"], "shortages", ["MAT-SEALANT"])).toBe("/sites/site-b?show=acted&material=MAT-SEALANT");
    expect(showFilterHref("site-b", ["data-problems"], "data-problems")).toBe("/sites/site-b");
    expect(showFilterHref("a/b", [], "shortages", ["c d&e"])).toBe("/sites/a%2Fb?show=shortages&material=c%20d%26e");
    expect(showFilterHref("site-b", [], "acted", ["MAT-A", "MAT-B"])).toBe(
      "/sites/site-b?show=acted&material=MAT-A&material=MAT-B",
    );
    expect(showFilterHref("site-b", ["shortages"], "shortages", [], "MAT-COLLAR-25")).toBe("/sites/site-b?fromMaterial=MAT-COLLAR-25");
    expect(showFilterHref("site-b", [], "shortages", ["MAT-COLLAR-25"], "MAT-COLLAR-25")).toBe(
      "/sites/site-b?show=shortages&material=MAT-COLLAR-25&fromMaterial=MAT-COLLAR-25",
    );
  });
});
