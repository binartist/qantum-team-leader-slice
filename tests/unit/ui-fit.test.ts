import { describe, expect, it } from "vitest";
import { fitRows } from "@/ui/fit";

const penetration = {
  orientation: "Wall",
  substrateDetail: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
  serviceType: "KELOX Pipe  - 13mm PE",
  serviceSize: "Ø32mm",
  requiredIntegrityMinutes: 60,
  requiredInsulationMinutes: 90,
};
const solution = {
  orientation: "Wall",
  substrateDetail: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
  serviceType: "KELOX Pipe  - 13mm PE",
  serviceSize: "Ø32mm",
  integrityMinutes: 60,
  insulationMinutes: 60 as number | null,
  supplierRefCode: "V21.11-PF 19061-81-D",
};

describe("AC 36: side-by-side rows for the penetration and its nominated solution", () => {
  it("shows every field for both sides and marks only the fields that do not fit", () => {
    expect(fitRows(penetration, solution, ["insulation"])).toEqual([
      { label: "Orientation", penetration: "Wall", solution: "Wall", fits: true },
      {
        label: "Substrate",
        penetration: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
        solution: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
        fits: true,
      },
      { label: "Service", penetration: "KELOX Pipe - 13mm PE", solution: "KELOX Pipe - 13mm PE", fits: true },
      { label: "Size", penetration: "Ø32mm", solution: "Ø32mm", fits: true },
      { label: "Integrity", penetration: "60 min required", solution: "60 min", fits: true },
      { label: "Insulation", penetration: "90 min required", solution: "60 min", fits: false },
      { label: "Supplier ref", penetration: "—", solution: "V21.11-PF 19061-81-D", fits: true },
      { label: "Material", penetration: "—", solution: "none recorded", fits: true },
    ]);
  });

  it("names the solution's materials and leaves the opening blank", () => {
    const rows = fitRows(penetration, { ...solution, materialNames: ["Pipe collar for 25 mm pipe", "Intumescent sealant, 310 ml cartridge"] }, []);
    expect(rows.find((row) => row.label === "Material")).toEqual({
      label: "Material",
      penetration: "—",
      solution: "Pipe collar for 25 mm pipe, Intumescent sealant, 310 ml cartridge",
      fits: true,
    });
  });

  it("says when nothing is required or nothing is claimed", () => {
    const rows = fitRows({ ...penetration, requiredInsulationMinutes: null }, { ...solution, insulationMinutes: null }, []);
    expect(rows.find((row) => row.label === "Insulation")).toEqual({
      label: "Insulation",
      penetration: "none required",
      solution: "none claimed",
      fits: true,
    });
  });

  it("marks exactly the row of each field that does not fit", () => {
    const labels: [string, string][] = [
      ["orientation", "Orientation"],
      ["substrate", "Substrate"],
      ["serviceType", "Service"],
      ["serviceSize", "Size"],
      ["integrity", "Integrity"],
      ["insulation", "Insulation"],
    ];
    for (const [field, label] of labels) {
      const marked = fitRows(penetration, solution, [field as never]).filter((row) => !row.fits);
      expect(marked.map((row) => row.label), field).toEqual([label]);
    }
  });

  it("collapses runs of spaces in every text cell", () => {
    const rows = fitRows(
      { ...penetration, substrateDetail: "FR  plasterboard,  wall", serviceSize: " Ø32 mm " },
      { ...solution, substrateDetail: "FR  plasterboard,  wall", serviceSize: "Ø32  mm", supplierRefCode: " V21  X " },
      [],
    );
    expect(rows.find((row) => row.label === "Substrate")).toMatchObject({ penetration: "FR plasterboard, wall", solution: "FR plasterboard, wall" });
    expect(rows.find((row) => row.label === "Size")).toMatchObject({ penetration: "Ø32 mm", solution: "Ø32 mm" });
    expect(rows.find((row) => row.label === "Supplier ref")).toMatchObject({ solution: "V21 X" });
  });

  it("prints unusable minutes as unknown, never NaN or Infinity", () => {
    const rows = fitRows({ ...penetration, requiredIntegrityMinutes: Number.NaN }, { ...solution, insulationMinutes: Number.POSITIVE_INFINITY }, []);
    expect(rows.find((row) => row.label === "Integrity")?.penetration).toBe("unknown min required");
    expect(rows.find((row) => row.label === "Insulation")?.solution).toBe("unknown min");
  });

  it("says why a cut-off substrate does not fit, instead of showing two identical texts", () => {
    const rows = fitRows({ ...penetration, substrateDetail: "FR plasterboard," }, { ...solution, substrateDetail: "FR plasterboard," }, ["substrate"]);
    expect(rows.find((row) => row.label === "Substrate")).toEqual({
      label: "Substrate",
      penetration: "FR plasterboard, (cut off)",
      solution: "FR plasterboard, (cut off in the catalogue)",
      fits: false,
    });
  });
});
