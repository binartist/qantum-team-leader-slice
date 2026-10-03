# Catalogue data model

Model of `data/solutions-excerpt.csv` only. This file is a solutions catalogue (148 Ryanfire rows). It does not include product kits, quantities, stock, sites, or schedules.

## Grain

One row is one tested fire-stopping **solution**: a specific penetrating service, through a specific substrate, at a stated size and fire rating, as published by one supplier.

`internal_code` and `supplier_ref_code` are both unique in this excerpt (148/148). Use `internal_code` as the QAntum key. Keep `supplier_ref_code` as the supplier's own identity.

## Columns

| CSV column | Field | Meaning |
| --- | --- | --- |
| Internal Code | `internal_code` | QAntum solution id (string, unique) |
| Supplier Ref. Code | `supplier_ref_code` | Supplier document/reference (unique here) |
| Supplier | `supplier` | Always `Ryanfire` in this excerpt |
| Orientation | `orientation` | `Wall`, `Floor`, or `Ceiling` |
| Substrate | `substrate_detail` | Free-text build-up (layers, thickness). Messy: extra spaces, truncated values like `FR plasterboard,` |
| Substrate Option | `substrate_option` | Coarse substrate family (15 values), e.g. `Plasterboard Wall`, `Concrete Floor` |
| Service Classification | `service_classification` | Broad class: combustible pipe, non-combustible pipe, insulated pipe, electrical, structural, other |
| Service Type | `service_type` | Specific penetrating item, including insulation wrap when present (`Copper Pipe - 38mm Nitrile Rubber`) |
| Service Type Option | `service_type_option` | Coarser label for the same item (19 values). Not always equal to service type (`PVC Socket` maps to `PVC Pipe`; `Blank` maps to `Other`) |
| Service Size | `service_size` | Diameter or opening size as printed (`Ø50mm`, `1100x10mm`). Not parsed to a number |
| Integrity | `integrity_minutes` | Minutes the seal holds flame and hot gas. Always a number in this file (30–240) |
| Insulation | `insulation_minutes` | Minutes the seal limits heat transfer. `-` means not claimed (8 rows); store as null |

## Shape

The CSV is denormalised. A normalised form that still matches the file:

```text
supplier
  id, name

substrate_option
  id, name                         -- coarse family

substrate
  id
  substrate_option_id
  detail                           -- the raw Substrate string
  orientation                      -- wall / floor / ceiling, as stated with that detail

service_classification
  id, name

service_type_option
  id, name                         -- coarse label

service_type
  id
  service_classification_id
  service_type_option_id
  name                             -- raw Service Type

solution
  internal_code          PK
  supplier_id
  supplier_ref_code      unique
  substrate_id
  service_type_id
  service_size
  integrity_minutes
  insulation_minutes     nullable
```

For the first slice, one `Solution` record per CSV row is enough. The lookups above are how the repeated text should be treated, not tables you must build on day one.

## Rules observed in this excerpt

- Substrate option is a rollup of substrate detail. Several different build-ups share one option (for example many plasterboard thicknesses all say `Plasterboard Wall`).
- Service type option is a rollup of service type, and it can hide a difference that matters (socket vs pipe, blank opening vs "other").
- Integrity and insulation are independent. Insulation can be missing while integrity is set.
- Nothing in a row names the products, collars, or sealants required to install it. The brief says the catalogue includes required products; this excerpt does not. Do not invent a product column and pretend it came from the file.

## Data quality notes

Checked against all 148 rows. These matter because exact matching is how substitutes are suggested (see `technical-design.md` section 6).

| Issue | Rows | Example |
| --- | --- | --- |
| Double space inside `Service Type` | 15 | `Copper Pipe  - 50mm Fibreglass` (`0375`) |
| Substrate cut off after the family name | 6 (`0853`, `0943`, `0944`, `0946`, `0952`, `0955`) | `FR plasterboard,` with no build-up |
| Space inside brackets | 2 | `( 1 layer 13mm)` (`0452`, `0479`) |
| Space between number and unit | 1 | `(51 mm)` (`0734`) |
| Same construction worded two ways | 2 | `385mm hollow core concrete floor` vs `385mm hollow core floor` (`0534`, `0535`) |
| Inconsistent `Service Size` shapes | 24 non-standard of 148 | `Ø50mm` (124), `80mm` (12), `1100x10mm` (9), `900mm x 50mm` (2), bare `60` (1) |

The substrate cut-offs are the serious one: they cannot identify a build-up, so they must not be treated as equal to each other. The others are cosmetic and handled by the normalisation rule. Case differences also exist, so comparison is case-insensitive.

Distinct raw substrates: 42. After whitespace and case normalisation: 41.

## Findings to report to the catalogue owner

The catalogue is owned upstream, so this slice does not correct it. These are findings to hand back, and they are listed again as known limitations in the README.

1. **Incomplete substrate on 6 solutions** (`0853`, `0943`, `0944`, `0946`, `0952`, `0955`). The build-up after the family name is missing, so the solution cannot be matched to a construction. This slice offers no substitutes for them.
2. **Same construction worded two ways** (`0534`, `0535`). One includes "concrete" and one does not. Please confirm whether they are the same build-up.
3. **Inconsistent formatting** in service type (15 rows with a double space), substrate (3 rows with stray spaces) and service size (five shapes). The slice normalises spacing only for comparison.
4. **No products or quantities.** The brief says the catalogue includes required products, but this excerpt does not. Shortage maths in this slice uses invented mappings.

## Out of this model

Stock, quantities, delivery dates, nominated site solutions, and crew schedules are sample data for the team-leader slice, not part of the catalogue.
