# Glossary

Plain-language meanings for the exercise, from the business point of view. Each entry says where the term comes from:

- **Brief**: stated in the exercise brief (kept outside the repo).
- **CSV**: visible in `data/solutions-excerpt.csv`.
- **Assumed**: our reading, not given in the source. Check with the business.
- **Sample**: invented for this slice.
- **Industry**: general passive fire knowledge, not defined in the brief. Treat as background and verify.

## 1. The business

**Passive fire protection.** Building elements that slow fire and smoke without any action or power: fire-rated walls, floors, doors and seals. Compare *active* protection such as sprinklers and alarms. *(Industry)*

**Compartmentation.** Dividing a building into fire-resistant cells (walls and floors) so a fire stays contained for a stated time. Everything in this exercise exists to keep that containment intact. *(Industry)*

**Penetration.** A hole through a fire-rated wall, floor or ceiling that a service (pipe, cable, duct) passes through. Every penetration weakens the compartment unless sealed. This is the unit of work for the team leader: one opening, one seal. *(Brief; "penetration" is used throughout)*

**Fire stopping.** The seal fitted around or in a penetration to restore the fire rating of the wall or floor. *(Brief)*

**Solution.** One tested, published way to fire-stop one specific situation: this service type, through this substrate, at this size, for this fire rating, from one supplier. A solution is a recipe, not a product. *(CSV: one row = one solution)*

**Nominated solution.** The solution the specifier chose for a given penetration. The installer is expected to fit exactly that. *(Brief: "solutions nominated for each site")*

**Specification.** The design document that says which solution goes where. In QAntum it lives in the web app. *(Brief)*

**Variation.** An installation that departs from the specification. QAntum flags these automatically. A substitute solution is a deliberate variation, so it needs approval before it is used. *(Brief)*

**Golden thread.** The continuous, trustworthy record of building safety information from design through install to inspection. It is why compliance evidence (pins, photos, approvals) matters and why a "probably fine" substitute is not acceptable. *(Brief; the term is from UK building safety regulation)*

**Compliance evidence.** The proof that the right thing was installed: a pin on the floor plan and a photo per penetration. *(Brief)*

## 2. People and systems

**Operative.** The installer on site. Uses the offline mobile app to install, pin and photograph. *(Brief)*

**Team leader.** Runs a crew of operatives on a site. Decides when and where the crew goes. This is our user. *(Brief)*

**Back-office manager.** Specifies, reviews pins and progress, and (assumed) approves substitutes. *(Brief for the role; approval duty is Assumed)*

**Quantity surveyor.** Tracks quantities and cost. Sees progress live. Not a user of this slice. *(Brief)*

**Purchasing / warehouse.** Where an escalation goes: purchasing orders more, the warehouse moves existing stock. *(Assumed; the brief says "others in the business")*

**Web app.** Existing QAntum app for administration, specification and reporting. Owns sites, penetrations and nominations. *(Brief)*

**Mobile app.** Existing offline-first Flutter app for operatives. Out of this slice. *(Brief)*

**Upstream system.** Any system this slice only reads from: sites, nominations, stock. *(Our term; see `slice-decisions.md`)*

## 3. The catalogue fields

**Internal code.** QAntum's own id for a solution, such as `0334`. The key used everywhere in this slice. *(CSV)*

**Supplier reference code.** The supplier's own document reference for the tested solution, such as `V1.11-22SFR00038-146-E`. Identifies the test or assessment behind the row. *(CSV)*

**Supplier.** Who published the solution. Always Ryanfire here. *(CSV)*

**Orientation.** Wall, floor or ceiling. A solution tested for a wall is not automatically valid in a floor. *(CSV)*

**Substrate.** What the hole goes through: the construction of the wall or floor (for example plasterboard of a given layer count and thickness, concrete, timber infill). Fire performance depends on it. *(CSV)*

**Substrate option.** A coarse grouping of substrates (such as "Plasterboard Wall"). Several different constructions share one option, so it is for browsing, not for deciding suitability. *(CSV; caution from `catalogue-data-model.md`)*

**Service.** The thing passing through the hole: a pipe, cable, duct, bundle or an empty opening. *(CSV: "penetrating service")*

**Service classification.** Broad class of the service: combustible pipe (melts or burns, such as plastic), non-combustible pipe (such as steel or copper), insulated pipe, electrical, structural, other. Plastic pipes burn away and leave a hole, so they need different seals. *(CSV for values; the reason is Industry)*

**Service type.** The specific item, including any insulation wrap, such as `Copper Pipe - 38mm Nitrile Rubber`. *(CSV)*

**Service type option.** A coarser label for the service type. It can hide a real difference (a socket is not a pipe). *(CSV)*

**Service size.** Pipe diameter or opening size as printed (`Ø50mm`, `1100x10mm`). Text, not a number. *(CSV)*

**Fire integrity.** How many minutes the seal stops flames and hot gas passing through. 60 means 60 minutes. See section 3a. *(CSV: "Integrity", 30 to 240)*

**Fire insulation.** How many minutes the seal keeps the far side cool enough not to ignite things. A dash means the supplier does not claim it, which is not the same as zero. Integrity and insulation are separate claims. See section 3a. *(CSV)*

**Fire rating.** Shorthand for the integrity and insulation figures together (for example 60/30). The nominated rating is the minimum a penetration must meet. *(Assumed shorthand)*

## 3a. Fire performance in depth (integrity, insulation and related terms)

Picture a fire on one side of a wall with a pipe through it. The seal around that pipe must do two different jobs, and the catalogue records each as a number of minutes.

**Integrity (E).** Job one: keep flames and hot gas from getting through to the other side. If the seal fails, fire spreads through the hole. In the CSV this is the `Integrity` column. It always has a value (30 to 240). Spread in this excerpt: 30 min (5 rows), 60 (72), 90 (10), 120 (55), 180 (4), 240 (2). *(CSV; E/I letters are Industry)*

**Insulation (I).** Job two: keep the *unexposed* face from getting hot enough to ignite something nearby, or to burn someone. A seal can stop flames yet still conduct heat through a metal pipe, so this is a separate, harder claim. In the CSV it is the `Insulation` column. Spread: not claimed (8 rows), 15 min (2), 30 (11), 45 (3), 60 (64), 90 (18), 120 (36), 180 (4), 240 (2). *(CSV)*

**Not claimed (`-`).** The supplier does not state an insulation time. It does not mean zero and it does not mean "fine". Treat it as unknown. For example, solution `0334` (copper pipe Ø100mm, 60 integrity, no insulation claim) cannot stand in for `0344` (steel pipe, 60/60) even though the integrity matches. *(CSV for the 8 rows; the reading is ours)*

**Reading a rating.** Written as integrity/insulation in minutes:

| Code | Service | Rating | What it tells the leader |
| --- | --- | --- | --- |
| `0334` | Copper pipe Ø100mm | 60 / not claimed | Holds flame 60 min. Says nothing about heat on the far side. |
| `0344` | Steel pipe Ø28mm | 60 / 60 | Holds flame and limits heat for 60 min. |
| `0345` | Copper pipe Ø100mm | 120 / 90 | Holds flame 120 min and limits heat for 90. |
| `0435` | KELOX pipe Ø32mm | 60 / 60 | Full 60 on both. |
| `0434` | KELOX pipe Ø32mm | 60 / 30 | Same pipe and size as `0435` but only 30 min insulation. Not interchangeable. |

**Insulation never exceeds integrity.** In all 148 rows insulation is at or below integrity, which fits how the two are defined: if flame gets through, the far side is no longer protected. *(Observed in CSV; reasoning is Industry)*

**Fire resistance period.** The overall time the penetration must last, often stated as one number on drawings (30, 60, 90, 120 minutes). It sets the integrity minimum. Whether the project also requires insulation is a second requirement. *(Industry; how QAntum stores the requirement is Assumed)*

**Required vs offered.** A penetration has a *required* rating from the specification. A solution *offers* a rating from its test. A solution is only a candidate if offered is at least required on **both** measures, and "not claimed" fails a stated insulation requirement. *(Our matching rule, `technical-design.md` section 6)*

**Fire test.** A laboratory test in which the exact build-up (wall, service, seal, size) is exposed to a standard fire curve, and the minutes to failure are recorded. This is where a solution's numbers come from. *(Industry)*

**Assessment (engineering judgement).** A written opinion from a qualified body that a variation on a tested build-up is also acceptable. Some supplier references may rest on assessments rather than direct tests. The CSV does not say which. *(Industry; not in CSV)*

**Why exact build-up matters.** The test result applies only to the tested combination. Change the substrate thickness, pipe material, insulation wrap or size and the number may no longer hold. This is the heart of the brief's warning that matching fields is not proof of compliance. *(Brief for the warning; explanation is Industry)*

**Insulated pipe vs fire insulation.** A name clash worth noting. "Insulated Pipe" (service classification) means a pipe wrapped in *thermal lagging* such as fibreglass, nitrile rubber or Thermobreak. "Insulation" (the rating) means *fire* heat-limiting performance. A lagged pipe can have an insulation rating of anything. 13 rows are Insulated Pipe. *(CSV)*

**Combustible vs non-combustible pipe.** Plastic pipes (PEX, PVC, PP-R and the like) burn or melt, leaving an open hole, so their seals must close the gap as the pipe disappears. Metal pipes stay put but conduct heat, which is why their insulation claim is often weak or missing. 76 rows are combustible, 19 non-combustible. *(CSV counts; behaviour is Industry)*

**Intumescent.** A material that swells when hot to fill gaps and block the hole. Typical in collars, wraps and sealants. *(Industry)*

**Typical products.** The kinds of items a solution might call for: collars, wraps, sealants or mastics, batts or boards, pillows. The excerpt does not list products, so our materials are sample data. *(Industry; absence from CSV is documented)*

## 4. The slice

**Planned work.** The set of penetrations on a site that the crew is due to install, each with a nominated solution. *(Brief, Assumed shape)*

**Required product / material.** A physical item used to install a solution (sealant, collar, wrap, board). The brief says the catalogue includes required products, but the excerpt has none. *(Brief; absent from CSV)*

**Quantity per install.** How much of a material one penetration uses. Not in the CSV. *(Sample)*

**Solution material.** Our join: for a solution, the materials and the quantity per install. *(Sample; our term)*

**Stock balance.** How much of a material is on hand, and where (warehouse or van). Read from the inventory system. *(Assumed system; Sample data)*

**Shortage.** Needed quantity for the planned work is greater than the quantity on hand. Calculated each time, never entered by anyone. Our design identifies it as site plus material. *(Our term; see `technical-design.md`)*

**Shortfall.** How much is missing: needed minus on hand. *(Our term)*

**Blocked / clear.** Crew status for a site. Blocked means at least one shortage (or missing data) stands between the crew and finishing the planned work. Clear means everything needed is in stock. *(Our term, from "ready vs blocked" in `slice-decisions.md`)*

**Unknown.** Data is missing (no stock record, no material mapping). We treat it as blocked with a stated reason, never as zero. *(Our rule)*

**Wait.** Decision: hold off until stock arrives. Recorded, but it does not unblock the crew. *(Our term)*

**Escalate.** Decision: pass the shortage to purchasing or the warehouse with a note. Recorded, and the crew stays blocked until stock changes. *(Our term)*

**Substitute (proposed).** Decision: suggest a different catalogue solution for a penetration because the nominated one cannot be installed. It is only a proposal until approved. *(Our term)*

**Catalogue match.** A candidate substitute whose catalogue fields line up with the penetration. It is evidence to start a review, not proof of compliance. Missing fields in the data (products, installation limits, test scope) mean a match cannot establish suitability on its own. *(Brief: "A matching catalogue field alone should not be treated as proof")*

**Approval.** A qualified person's sign-off that a substitute is acceptable. After approval, the web app changes the nomination. This slice never approves. *(Assumed process; slice boundary from `slice-decisions.md`)*

**Idempotency.** Sending the same request twice records it once. Matters on poor mobile signal where taps get repeated. *(Technical term)*

## 5. Quick contrasts

| Easily confused | Difference |
| --- | --- |
| Solution vs product | A solution is the tested recipe for a situation. Products are the items used to build it. The CSV has solutions only. |
| Integrity vs insulation | Integrity stops flame and gas getting through. Insulation limits heat on the far side. A seal can have one without the other. |
| Substrate vs substrate option | Substrate is the exact construction. Option is a loose family name. |
| Wait vs escalate | Wait holds. Escalate asks someone else to act. Neither frees the crew. |
| Substitute vs approved substitute | A substitute is proposed by the leader. Approval comes from elsewhere and is what changes the nomination. |
| Blocked vs unknown | Blocked has a known cause. Unknown means we lack data, and we still do not say "clear". |
| Variation vs substitute | A variation is any departure from spec. An approved substitute is a controlled, recorded one. |

## 6. Terms to confirm with the business

- Does "fire rating" mean the pair integrity/insulation, or something stricter in QAntum?
- Who approves a substitute, and does that queue exist today?
- Who receives escalations, and in what form?
- Is stock per warehouse, per van, per site allocation, or all three?
- Is the crew blocked for the whole site while one material is short, or only for the affected penetrations?
