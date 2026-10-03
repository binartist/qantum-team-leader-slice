# Business path and data gaps

Walk of the team-leader path in the brief. Each step names the records it needs, which fields the catalogue already has, and what is missing.

Legend: **have** = in `solutions-excerpt.csv`. **assume** = exists in QAntum but not in this file. **sample** = invent for the slice.

## Path

1. A site has planned penetrations, each tied to a nominated solution.
2. Before the crew leaves, the team leader asks what materials that plan needs and whether they are in stock.
3. A shortage is either escalated, waited on, or met by a different solution.
4. The leader uses that result to schedule the crew.

Operatives installing, pinning, and photographing stay on the mobile app. This path stops at "ready to send the crew, or not."

## 1. Nominated work

Lives in the existing web specification, not the catalogue, and not in this slice's database.

The team-leader app is isolated from that system. It does not join penetration or nomination tables. It calls two read APIs and treats the responses as an upstream contract. In the exercise both are stubbed with sample JSON of the same shape.

- `GET /sites` returns the sites a team leader can open (id, name, address or job reference).
- `GET /sites/{id}/nominations` returns that site's planned penetrations and nominated `internal_code` values.

**Penetration** (assume, one opening on a site)

- site, floor/plan, location
- orientation, substrate, service type, size (so it can match a solution)
- required integrity and insulation
- nominated `solution.internal_code`
- status: planned / ready / blocked

**Gap:** the CSV has no site, plan, or nomination. Sample a few penetrations that point at real `internal_code` values.

## 2. What the solution needs

**Solution** (have): codes, supplier, orientation, substrate, service, size, integrity, insulation. See `docs/catalogue-data-model.md`.

**Gap:** no products and no quantities. The brief says the catalogue includes required products; this excerpt does not.

**Solution material** (sample, join solution to a material)

- `solution.internal_code`
- material
- quantity per installation

Without this join, "materials required for the planned work" cannot be computed.

## 3. Is it in stock?

**Material** (sample): name, unit.

**Stock balance** (upstream, sample): material, quantity on hand, location (warehouse or van).

The team-leader app does not own inventory and does not write it. It reads balances from an existing system, stubbed as `GET /stock` (or stock for the materials a site needs). The brief does not show this inside the catalogue or the spec app, so treat it as another upstream system, not as tables in this slice.

**Gap:** no stock, delivery dates, or warehouse in the supplied file. Sample balances, including at least one short item.

Derived, not stored: for a set of penetrations, required quantity = sum of solution-material quantities. Shortage = required − on hand, when required is greater.

## 4. What the leader does

**Shortage** (sample, the decision record)

- which penetrations and material
- shortfall quantity
- choice: escalate / wait / substitute
- status: open / escalated / waiting / resolved

**Escalation** (sample): shortage, who it goes to (purchasing or warehouse), note, created at.

**Substitution** (owned as a proposal, only if the slice includes it): penetration, from solution, to solution, why it might fit, status `proposed`.

Approval is downstream, not in this app. A manager would accept or reject it in the existing web app before the nomination changes. The brief shows managers and clients reviewing install progress and variations, not a pre-site approval queue, so do not assume that audit workflow already exists. Catalogue match is not approval. Escalate and wait do not need that approval.

**Schedule** (assume exists for crews; sample only the bit this slice needs): crew, site, date, blocked or clear based on open shortages.

## Where it lives

| Record | Where |
| --- | --- |
| Solution | Catalogue. Real CSV. |
| Penetration, nomination | Existing spec system, read via API. Sample JSON stands in for that endpoint. |
| Material, quantity per solution | Not in the excerpt. Sampled. |
| Stock balance | Upstream inventory system, read-only via API. Sample JSON stands in. |
| Shortage, escalation, substitution | New team-leader slice. |
| Crew schedule | Existing operations. Slice only reads "blocked or not." |
| Install, pin, photo | Mobile app. Out of this slice. |

## First-slice boundary

In: nominated penetrations, materials those solutions need, stock check, one action (escalate or wait).

Out: real auth, real stock system, automatic compliant substitution, mobile install.

## Action endpoints

The leader experience stores actions only. It does not persist sites, nominations, stock, or the catalogue. Those are read from upstream systems (the catalogue from the supplied CSV in this exercise).

- `POST /sites/{id}/shortages/{shortageId}/wait` records wait. Crew stays blocked until stock changes.
- `POST /sites/{id}/shortages/{shortageId}/escalate` records an escalation to purchasing or the warehouse. Body: note, who it goes to.
- `POST /sites/{id}/penetrations/{penetrationId}/substitutions` records a proposed substitute. Body: from `internal_code`, to `internal_code`, reason. Status stays `proposed`.
- `GET /sites/{id}/actions` lists wait, escalate, and substitution proposals for that site.

Approval of a substitution is not here. The existing web app would later update the nomination.
