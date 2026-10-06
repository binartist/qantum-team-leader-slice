import { describe, expect, it } from "vitest";
import { describePenetration } from "@/application";
import { PenetrationNotFoundError, SiteNotFoundError } from "@/ports";
import { testDependencies } from "../api/support";

describe("AC 36: penetration detail compares the penetration with its nominated solution", () => {
  it("returns both sides and the fields that do not fit (pen-c-02 needs 90 min insulation, 0435 claims 60)", async () => {
    const detail = await describePenetration(testDependencies(), "site-c", "pen-c-02");
    expect(detail.penetration).toMatchObject({
      id: "pen-c-02",
      floor: "L1",
      location: "Riser 1",
      orientation: "Wall",
      substrateDetail: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
      serviceType: "KELOX Pipe  - 13mm PE",
      serviceSize: "Ø32mm",
      requiredIntegrityMinutes: 60,
      requiredInsulationMinutes: 90,
      nominatedCode: "0435",
    });
    expect(detail.nominated).toMatchObject({
      internalCode: "0435",
      supplierRefCode: "V21.11-PF 19061-81-D",
      orientation: "Wall",
      integrityMinutes: 60,
      insulationMinutes: 60,
    });
    expect(detail.mismatches).toEqual(["insulation"]);
  });

  it("a nominated solution that fits has no mismatches", async () => {
    const detail = await describePenetration(testDependencies(), "site-b", "pen-b-01");
    expect(detail.nominated?.internalCode).toBe("0438");
    expect(detail.mismatches).toEqual([]);
  });

  it("an unknown nominated code has no catalogue side to compare", async () => {
    const detail = await describePenetration(testDependencies(), "site-c", "pen-c-03");
    expect(detail.nominated).toBeNull();
    expect(detail.mismatches).toEqual([]);
  });

  it("an unknown site or penetration is not found", async () => {
    await expect(describePenetration(testDependencies(), "site-x", "pen-c-02")).rejects.toBeInstanceOf(SiteNotFoundError);
    await expect(describePenetration(testDependencies(), "site-c", "pen-none")).rejects.toBeInstanceOf(PenetrationNotFoundError);
  });
});
