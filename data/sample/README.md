# Sample data

Everything in this folder is **invented** for the exercise. Only `../solutions-excerpt.csv` is real, plus the
`nominatedCode` values in `nominations.json`, which are real catalogue codes (with one deliberate missing code,
`9999`). Each file carries a `label` field saying so.

| File | Stands in for |
| --- | --- |
| `sites.json` | the existing spec system's `GET /sites` |
| `nominations.json` | `GET /sites/{id}/nominations` (keyed by site id) |
| `solution-materials.json` | materials and quantity per install per solution, which the supplied catalogue lacks |
| `stock.json` | the inventory system's `GET /stock` |

The scenario, the numbers and why they were chosen are in `docs/sample-data-and-stubs.md`.
