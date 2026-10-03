# Sample data and upstream stubs

Proposal for the invented data and the upstream contract the API layer will build against. Status: **approved 2026-10-03**. The four JSON files in `data/sample/` already exist and were checked by running the real domain code over them (results in section 4). Terms are in `glossary.md`. Requirements are in `slice-specification.md` section 7.

**Everything here is invented except the catalogue.** Only `data/solutions-excerpt.csv` and the `nominatedCode` values are real. Every sample file carries a `label` field saying so.

## 1. Design goal

Four sites, each chosen so that one screen state of the demonstration scenario happens with no fiddling, and so that the awkward cases the review found are visible on screen, not only in tests.

| Site | Crew status | What it shows |
| --- | --- | --- |
| `site-a` Riverside Plaza, Block A | clear | The happy path. Also uses stock that site B is short of, which makes "shared, not reserved" visible |
| `site-b` Harbour Point, Levels 3 to 5 | blocked | Two shortages, a multi-location sum, substitutes with and without stock, and every kind of empty state |
| `site-c` Kingsway Works, Phase 2 | blocked | Missing data: unknown solution code, no material mapping, a material with no stock record, an incomplete substrate |
| `site-d` Old Mill Annex | nothing planned | The case that must never read as clear |

## 2. The data

### Materials (invented)

| Id | Name | Unit |
| --- | --- | --- |
| `MAT-SEALANT` | Intumescent sealant, 310 ml cartridge | cartridge |
| `MAT-COLLAR-25` | Pipe collar for 25 mm pipe | each |
| `MAT-COLLAR-32` | Pipe collar for 32 mm pipe | each |
| `MAT-WRAP` | Intumescent wrap strip | metre |
| `MAT-BATT` | Mineral wool batt | each |
| `MAT-PUTTY` | Fire putty pad | each |
| `MAT-MASTIC` | Fire mastic tube | tube |

Names are generic on purpose. They are not claims about what Ryanfire actually specifies for a solution.

### Solution to material mapping (invented, quantity per install)

| Code | Service | Materials |
| --- | --- | --- |
| `0344` | Steel pipe Ø28 | wrap 1.5, sealant 0.5 |
| `0375` | Insulated copper Ø32 | wrap 2, sealant 0.5 |
| `0452` | PEX-AL Ø25 | collar-25 1 |
| `0438` | PEX Ø25, 60/30 | collar-25 1, sealant 0.5 |
| `0451` | PEX Ø25, 60/60 (candidate for 0438) | putty 1, sealant 0.25 |
| `0464` | PEX Ø25, 60/60 (candidate for 0438) | **no mapping, deliberately** |
| `0434` | KELOX Ø32, 60/30 | collar-32 1, sealant 0.25 |
| `0435` | KELOX Ø32, 60/60 (candidate for 0434) | collar-32 1, sealant 0.5 |
| `0789` | Blank 1100x10, 60/60 | sealant 2, batt 1 |
| `0790` | Blank 1100x10, 120/120 (candidate for 0789) | sealant 2, batt 2 |
| `0791` | Blank 1100x10, 120/60 (candidate for 0789) | sealant 3, batt 1 |
| `0334` | Copper Ø100, 60/not claimed | batt 2, sealant 1 |
| `0347` | Copper Ø100, 60/60 (candidate for 0334) | batt 2, putty 2 |
| `0943` | Blank 50mm, incomplete substrate | sealant 1, mastic 1 |
| `0393` | HVAC bundle, floor | **no mapping, deliberately** |

Quantities include fractions (0.25, 0.5, 1.5) so that round-up is visible in the totals.

### Penetrations by site

All use real catalogue fields copied from the CSV row of the nominated code, with the required rating set equal to that row's rating.

| Site | Nominations (count x code) |
| --- | --- |
| A | 2 x `0344`, 2 x `0375`, 2 x `0452` |
| B | 4 x `0438`, 3 x `0434`, 2 x `0789`, 1 x `0344`, 2 x `0334` |
| C | `0943`, `0435`, one nominating `9999` (**not in the catalogue**), one nominating `0393` |
| D | none |

### Stock (invented)

| Material | Location | Quantity |
| --- | --- | --- |
| sealant | Warehouse | 6 |
| sealant | Van 2 | 2 |
| collar-25 | Warehouse | 2 |
| collar-32 | Warehouse | 5 |
| wrap | Warehouse | 12 |
| batt | Warehouse | 10 |
| putty | Warehouse | 20 |
| mastic | (no record, deliberately) | |

## 3. Why these numbers

- **Sealant is held in two places** (6 and 2), so on hand is 8 only if locations are summed (AC 3).
- **Sites A and B both draw on sealant and collar-25.** A needs 2 of each and is clear. B needs 10 sealant and 4 collar-25 and is short. Together they need more than exists, which is exactly the over-commit that shared, unreserved stock cannot see. The screen label says so, and the demo can point at it (AC 10).
- **Site B's substitutes are all different kinds.** `0438` has two candidates: `0451` (materials in stock) and `0464` (no mapping, so "no material mapping" is shown). `0434` has one in-stock candidate. `0789` has two candidates that need the same scarce sealant. `0334` has one candidate with in-stock materials. `0344` has none, so the empty state with the escalate option appears.
- **Site C's penetration nominating `0943`** is mapped, so the site is not blocked by it, but its substitute view says the catalogue substrate is incomplete (AC 21). The mapped mastic has no stock record, which gives an unknown-stock shortage that the leader can act on.
- **Site D** is the nothing-planned case (AC 8).

## 4. Verified outcomes

Run through the real `computeSiteReadiness` and `findCandidates` over the files, not worked out by hand:

| Site | Crew | Shortages | Blockers |
| --- | --- | --- | --- |
| A | clear | none | none |
| B | blocked | sealant short: needs 10 (9.25 rounded up), on hand 8, short 2, across 12 penetrations. Collar-25 short: needs 4, on hand 2, short 2 | none |
| C | blocked | mastic unknown: needs 1, on hand unknown | `unknown_solution_code` (`9999`), `no_material_mapping` (`0393`) |
| D | nothing planned | none | none |

Candidates: `0438` gives `0451`, `0464`. `0434` gives `0435`. `0789` gives `0790`, `0791`. `0334` gives `0347`. `0344` gives none. `0452` gives `0465`. `0943` is `substrate_incomplete`. `9999` is `nominated_code_unknown`.

The first run of this check found a bug in my own generated data: penetrations carried `siteId` `a` and `b` instead of `site-a` and `site-b`, so sites A and B read as nothing planned. It is fixed, and the contract test in section 7 now guards it.

## 5. Upstream contract

The four upstream reads, as the app expects them. The stubs implement these. A real client would parse the same shapes.

| Read | Returns |
| --- | --- |
| `GET /sites` | `{ sites: Site[] }` |
| `GET /sites/{id}/nominations` | `{ siteId, penetrations: Penetration[] }` |
| `GET /stock?materialIds=a,b` | `{ asOf, balances: Balance[] }`, only the requested materials |
| `GET /solution-materials?codes=x,y` | `{ materials: Material[], items: SolutionMaterial[] }`, only the requested codes |

Asking for stock and mappings by id keeps responses small and avoids fetching the whole inventory, as noted in the design review.

```ts
// src/ports/schemas.ts (Zod). Shared by the stubs and any future HTTP client.
const Id = z.string().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/); // no ':' (shortage id is siteId:materialId)

Site            = { id: Id, name: string, reference: string, address?: string }
Penetration     = { id: Id, siteId: Id, floor: string, location: string,
                    orientation: "Wall" | "Floor" | "Ceiling",
                    substrateDetail: string, serviceType: string, serviceSize: string,
                    requiredIntegrityMinutes: number | null,
                    requiredInsulationMinutes: number | null,
                    nominatedCode: string }
Balance         = { materialId: Id, location: string, quantity: number }
Material        = { id: Id, name: string, unit: string }
SolutionMaterial= { internalCode: string, materialId: Id, quantityPerInstall: number }
```

Contract rules:

- **Structure is strict, values are lenient.** A missing field, wrong type or bad id rejects the whole response and the API returns 502 with an `upstream_invalid` code. A negative quantity is a legal number, so it passes through and the domain turns it into an `invalid_quantity` blocker or an unknown material. Failing the whole page for one bad row would hide the other sites' good data, and it would make the domain's fail-closed rules unreachable.
- **Unknown extra fields are ignored**, so a real system can add fields without breaking the app.
- **Numbers must be finite.** `JSON.parse("1e999")` gives `Infinity`, so the schema checks finiteness explicitly.
- **Display fields** (`floor`, `location`, `reference`, `address`) are for the screen only. The domain does not read them.

## 6. Stub implementation

- **Where:** `src/adapters/stub/` implements the four ports from the JSON in `data/sample/`, validating every file with the schemas above. Ports are in `src/ports/`.
- **Why files and not HTTP routes:** the deployed demo stays self-contained, and swapping in a real client changes one adapter per port. The schemas are the contract, so the stubs lose no realism that matters.
- **Failure modes for tests:** each stub takes an option: `normal`, `down` (throws an upstream error), `empty` (valid but no data), `malformed` (fails the schema). This is how AC 9 and the 502 tests run.
- **No public fault switch.** The deployed URL cannot be told to fail. If the panel wants to see "stock unavailable", an environment variable can enable it on a preview deployment only. This is an open question below.
- **Errors:** a stub failure becomes one `UpstreamError` with a code, never a raw message, so no path or file content reaches the client.

## 7. Tests this data supports

- **Contract:** each sample file validates against its schema. Every nominated code exists in the catalogue except `9999`. Every penetration's `siteId` equals the key it sits under (the bug in section 4). Every mapped `materialId` exists in `materials`. No id contains `:`.
- **Scenario:** the outcomes in section 4 hold, as an end-to-end and an API test (AC 1, 2, 3, 5 to 8, 10, 18 to 21).
- **Failure modes:** each stub mode produces the right 502 or empty state, and none produces `clear`.
- **Guard against drift:** a test pins the candidate sets for the demo codes, so a catalogue or rule change fails loudly.

## 8. What this lets us show, and what it leaves untested

Shows: the whole decision loop against realistic, awkward data, every empty and missing-data state, and the contract the real systems would have to meet.

Does not show: real latency, real authentication, real data quality, concurrent stock movement, or whether actual materials and quantities look like these. Those need the real systems, which is iteration 2.

## 9. Open questions

Decided on approval (2026-10-03): the generic material names stay, one `Van 2` location is enough, and no fault switch is built now. A preview-only stock-down switch remains an option for the walkthrough.
