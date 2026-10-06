# First-slice specification

Slice: **site readiness and shortage decisions for team leaders.** Boundary and endpoints are in `slice-decisions.md`. Architecture is in `technical-design.md`. Terms are in `glossary.md`. Where this spec and the design disagree, fix the spec first, then the design.

## 1. Purpose

Before a crew leaves for a site, the team leader needs to know whether the materials for the planned penetrations are in stock, and what to do about any shortage. The slice answers "can I send the crew?" and records the leader's decision when the answer is no.

**Users.** Primary: team leader. Secondary (receives the output, not a user of the slice): purchasing, warehouse, and the manager who would review a substitute.

**Value.** Replaces checking stock by phone or spreadsheet. Makes the shortage visible once, with a recorded decision, so crew planning can rely on it.

## 2. Scope

**In:** list sites, compute readiness for a site, show shortages and missing-data blockers, show each material's shared stock against every site's need, record wait, escalate and substitute-proposal, list recorded actions, suggest catalogue-similar substitutes.

**Out (see section 8):** real auth, real inventory or nomination systems, approving substitutes, stock reservation across sites, crew scheduling, offline use, install, pins and photos.

## 3. Functional requirements

| ID | Requirement |
| --- | --- |
| FR1 | A leader can list the sites available to them, each showing crew status (clear, blocked, nothing planned, or unavailable). |
| FR2 | For a site, the app computes materials required as the sum of quantity per install across its planned penetrations, grouped by material. Fractions round up to whole units. |
| FR3 | The app compares required quantity with stock on hand. On hand is the sum across all the leader's locations, is shared between sites, and is labelled as not reserved. |
| FR4 | A material where required exceeds on hand is shown as a shortage with required, on hand, shortfall and the affected penetrations. |
| FR5 | Missing data is never treated as zero. A material with no stock record is an actionable shortage of kind unknown. A nominated code with no catalogue entry, a nominated solution that does not fit its penetration (orientation, substrate, service, size, or a rating below the requirement), no material mapping, or an invalid mapped quantity (negative or not a finite number) is a blocker with a stated reason. Stock that is negative or not a finite number makes the material unknown. |
| FR6 | Crew status is blocked while any shortage or blocker exists, whatever decisions have been recorded. A site with no planned penetrations is "nothing planned", never clear. |
| FR7 | A leader can record **wait** on a current shortage, with an optional note. |
| FR8 | A leader can record **escalate** on a current shortage to purchasing or the warehouse, with a note. |
| FR9 | Wait and escalate do not change crew status. The screen says so when they are recorded. |
| FR10 | A recorded action is current only while the shortfall has not grown beyond what it was when recorded. Otherwise it appears as an earlier decision. Actions always show date and author. |
| FR11 | For a penetration, the app suggests substitutes from the catalogue using the matching rules in `technical-design.md` section 6. Each suggestion is labelled "catalogue match, not verified" and shows whether its materials are in stock. A material this site is already short of, or has no stock record for, never counts as in stock. |
| FR12 | A leader can record a **proposed substitute** for a penetration, choosing only from the suggested candidates and giving a reason. Status is always proposed. The nomination is not changed. |
| FR13 | When there are no candidates, the app says so. It offers escalate only when the penetration has a data problem; a material shortage is waited on or escalated on its material page. When the substrate is incomplete in the catalogue, it says that. |
| FR14 | A leader can list all recorded actions for a site, newest first. |
| FR15 | Every screen has a defined state for loading, empty, error and upstream-unavailable. Upstream failure never shows crew as clear. |
| FR16 | Every write requires an idempotency key, and a repeat records once. A repeat for the same target returns the original even if the shortage has since resolved. A repeat for a different target is rejected with 409. |
| FR17 | A drawer side menu gives the three top-level views, Sites, Materials and the Actions log. Materials shows each material a site plans to use against the one shared stock, across sites, and is where a site's shortage is waited on or escalated. The Actions log lists every site's recorded decisions and proposals. A decision on a penetration also shows on its list row as a mark, and the penetration page has its own actions log. |

## 4. Acceptance criteria

Numbered for use as test names. Sample data is defined in section 7.

**Readiness**
1. Given site A with penetrations needing 12 and 8 units of material M and 15 on hand, then M shows required 20, on hand 15, shortfall 5, and crew status is blocked.
2. Given every material is covered, crew status is clear.
3. Given M is held in two locations of 6 and 9, on hand is 15.
4. Given a fractional requirement of 2.2 units, required shows 3. On hand is snapped to the same precision, so ten balances of 0.1 cover a requirement of 1, and stock of 4.2 against a requirement of 5 is short by 0.8.
5. Given a material with no stock record, it appears as an unknown shortage with null quantities, and wait and escalate are accepted for it. A stock row that is negative or not finite, or a sum that is not finite, also makes the material unknown.
6. Given a nominated code absent from the catalogue, a blocker `unknown_solution_code` is shown, crew is blocked, and wait is rejected with 422 while escalate is accepted.
7. Given a nominated code with no material mapping, a blocker `no_material_mapping` is shown and crew is blocked. Given a mapped quantity that is negative or not finite, a blocker `invalid_quantity` is shown, the penetration adds no requirement, and crew is blocked (it never cancels another penetration's need).
8. Given a site with no penetrations, status is "nothing planned", not clear.
9. Given the stock service fails, the API returns 502, the UI shows the approved can't-check banner ("Can't check this site right now. Don't assume it's clear. Try again."), and no clear status is shown. On the sites list that site shows the chip "Can't check".
10. Given two sites that each need 10 units of M with 15 on hand, both show clear, and the screen labels the figure "on hand, shared, not reserved".

**Decisions**
11. Recording wait on a current shortage returns 201 and the shortage shows state waiting. Crew status stays blocked.
12. Recording escalate requires `escalateTo` of purchasing or warehouse. A missing or invalid value returns 422.
13. Recording an action on a shortage that does not currently exist returns 404.
14. Given escalate then wait, the shortage state is escalated and both actions are listed.
15. Given an action recorded at shortfall 5 and the shortfall is now 8, the action shows "earlier decision, shortfall has grown" and the shortage state is open.
16. Repeating a POST with the same idempotency key and target returns the original record (200) and creates no second row, even after the shortage has resolved or the nomination has changed. The same key for a different target is 409 `idempotency_key_reused`. A POST without a key returns 400. Keys are unique per user.
17. A note or reason longer than 500 characters after trimming is rejected with 422, and a whitespace-only reason is rejected. A body over 10,000 bytes is rejected with 413 while streaming, whether or not `Content-Length` is sent.

**Substitution**
18. For penetration with nominated `0438` (PEX Ø25mm, wall, 60/30), candidates are `0451` and `0464`.
19. For `0789`, candidates are `0790` and `0791`. For `0434`, the candidate is `0435`.
20. For `0344`, there are no candidates and the empty state says so. It offers escalate only when the penetration has a data problem; the sealant shortage it uses is decided on the sealant's material page.
21. For a solution whose substrate is incomplete (`0943`), there are no candidates and the message says the catalogue substrate is incomplete.
22. A candidate whose insulation is not claimed is never offered for a stated insulation requirement.
23. Proposing a `to` code that is not a current candidate returns 422. A `from` code that is not the penetration's current nomination returns 409.
24. A successful proposal has status proposed, stores the reason, and does not change the nomination or the shortage.
25. Exactly 20 of the 148 catalogue solutions have at least one candidate under the matching rules (each solution's own rating taken as the requirement, incomplete substrates excluded). The test fails if this changes.

**Data and safety**
26. The catalogue loads all 148 rows, preserves raw text, and flags 6 rows with an incomplete substrate. The load check fails if either count changes.
27. Every sample penetration references an `internal_code` present in the catalogue (except the one deliberate missing-code case).
28. The client never receives database credentials.
29. Readiness and actions responses carry `Cache-Control: no-store`.

**Experience**
30. Every shortage shows its material, required, on hand, short by, the penetrations it is planned on, and its state, without relying on colour alone.
31. All controls are keyboard operable, and interactive targets are at least 44px.
32. On a 375px wide screen, nothing needs horizontal scrolling.
33. A candidate that uses a material the site is already short of has availability `short`, even when one install fits in the stock on hand. A material whose site stock is unknown makes the candidate `unknown`. Shortages of other materials leave a candidate that fits on hand `in_stock`.
34. On the site screen, a blocked site has no summary banner. Filter chips for shortages, data problems and recorded actions count the penetrations and narrow the list, and each row still shows its own line. A clear site's banner still reads "Crew can go." The sites list chip still names the shortage and data-problem counts.
35. A penetration whose nominated solution differs on orientation, normalised substrate, normalised service type or normalised size, or falls short of a stated integrity or insulation requirement, gets a `solution_mismatch` blocker listing the failing fields. The crew is blocked, wait is rejected with 422, escalate is accepted, and the penetration adds no material need. Text that differs only by spacing or capitals is not a mismatch. A substrate cut off after the family name, on either side, never fits, even against identical cut-off text. Blank text, or a requirement or rating that is not a usable number, never fits.
36. The penetration page shows each field side by side for the penetration and its nominated solution, and marks every field that does not fit with an icon and text, never colour alone.
37. On the sites list, the materials list, the actions log and the landing page, the leading header control opens a left drawer listing Sites, Materials and Actions log, with the current section marked (About this demo, when the landing page is open), and, at its foot, a theme choice (System, Light, Dark; System follows the device, and a choice is remembered on this device and applied before the page paints) and a link to the landing page. Escape, the backdrop, the close control and choosing a link close it, and focus returns to the menu control when the drawer closes without navigating. Inner screens lead with the back control instead, never both.
38. The materials list shows each material any site plans to use, by name, with on hand (or stock unknown), every site's need added up, and how many sites are short. A site that could not be checked is never counted as not short, and the total is then left out. When no site is short alone but the sites together need more than is on hand, the row says so instead of "not short" (stock is shared and not reserved).
39. A material page shows the shared stock and its age once, then one section per site that plans the material: that site's need, short by (or "not short for this site alone"), its places with identical ones grouped, and, only where it is short, the decision scope, state, Wait and Escalate. A site that could not be checked says so and is never shown as enough.
40. On the penetration page, a shortage of the nominated solution (and of a substitute, when the site is already short of that material) is a line with this site's figures ("this site short 2 of 4", or "this site needs 1" when stock is unknown) that links to the material page at this site's section.
41. The former site-scoped material URL redirects to the material page at that site's section.
42. A material page opened from a penetration's shortage line has a back control that returns to that penetration. Opened any other way, or with a `from` that is not a penetration using the material, it returns to Materials.
43. The Actions log, from the side menu, shows one section per site in site order, each headed by a link to the site, with its recorded decisions then its proposals, newest first, with date, author and whether each still applies. A material decision opens the material page at that site's section, a data-problem decision or a proposal opens its penetration, and a resolved decision has no link. A site whose log cannot be read says so and never reads as nothing recorded; with no site readable the page is unavailable. Each site heading starts with the site icon and stays in view while its entries scroll. A page opened from the log (a site, a penetration or a material page) has a back control that returns to the log; opened any other way, or with an origin that is not one of its sites, back goes to its parent as before. The site and penetration pages have no actions log control, and the old `/sites/<id>/actions` URL opens the log at that site's section.
44. On the site screen, each penetration row shows its problems and decisions as icon marks inside the row's link, in the same order as before (problems, then Escalated, then Waiting), with a repeated kind's count beside its icon. Every mark has its full wording (for example "Short material × 2") for screen readers and on hover, and marks differ by shape as well as colour. The row stays one link; the marks are not controls.
45. The penetration page has two tabs, Solution (the default) and Actions log, as links (`?tab=log`) with the current one marked. Solution holds the nominated solution and substitutes. Actions log lists this penetration's decisions newest first: waits and escalations on a site shortage of a material its nominated solution uses (including resolved ones), on its own data problem, and substitutes proposed for it, each with date, author and whether it still applies. A material decision that still has a shortage says it applies to all N penetrations at this site, and opens the material page, whose back control returns to this tab. The tab shows a count; when the log cannot be read, it shows no number and never "nothing recorded". Tab links keep the log origin (`fromLog`).

## 5. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | Readiness for a site of 200 penetrations returns in under 1 s on the deployed app. |
| Safety | Fail closed: missing or unavailable data never produces a clear status. |
| Security | The app connects as a database role that can only read and insert the two action tables (append-only enforced by the database). Server-side credentials only, TLS in production. Author set on the server. Input validated at the boundary with a schema. Errors return `{code, message}` only. |
| Privacy | Logs contain ids and codes, not notes or reasons. |
| Accessibility | Meets WCAG 2.2 AA for every screen: contrast, focus order, labels, status not by colour alone. |
| Maintainability | Domain core has no framework or I/O imports. Each upstream sits behind one port. |
| Auditability | Actions are append-only with actor and timestamp. |
| Delivery | CI runs typecheck, lint, unit, API, database and end-to-end tests. Deploy follows a green run. |

## 6. Assumptions

Each is carried into the README as a known assumption.

1. Nominations include each penetration's orientation, substrate, service type, size, and required integrity and insulation.
2. Solution-to-material quantities exist in some form upstream. Here they are invented.
3. Stock is one shared figure per material, summed over locations.
4. Purchasing and warehouse are the escalation targets.
5. A team leader may open any site in the sample. Site membership is not modelled.
6. A shortage blocks the whole site. Partial dispatch is a later iteration.
7. Approval of substitutes happens elsewhere, in a process this slice does not depend on.
8. Site and material ids contain no `:` (the shortage id is `siteId:materialId`). Upstream data is validated at the boundary, and the domain additionally fails closed on bad numbers.
9. The catalogue file path is trusted server configuration, never user input.

## 7. Sample data (all invented, clearly labelled)

Lives in `data/sample/` with a README that says so. The CSV is the only real data.

- **Sites:** at least three. One clear, one blocked by a shortage, one with a missing-data case.
- **Materials and mappings:** a small set (for example sealant, collar, wrap), mapped to the demo codes `0438`, `0789`, `0434`, `0344`, `0334` and their candidates `0451`, `0464`, `0790`, `0791`, `0435`, `0347`.
- **Stock:** one material comfortably in stock, one short, one held in two locations, and one with no record.
- **Penetrations:** include one nominating a code missing from the catalogue, and one nominating `0943` (incomplete substrate).
- **Requirements:** integrity and insulation on each penetration, set equal to the nominated solution's own rating, except pen-c-02, which needs 90 min insulation against 0435's 60 to show AC 35.

## 8. Exclusions

Real authentication, a real inventory or nomination service, approval of substitutes, stock reservation or allocation, crew scheduling, offline use, rate limiting, push notifications, install, pins and photos, other suppliers, and editing the catalogue.

## 9. Demonstration scenario

1. Open the app. The landing page says it is a demo with invented data. From the menu, open Sites: site B is blocked.
2. Open site B. The page lists the penetrations. There is no blocked banner. Filter chips count the penetrations, and the stock figures are labelled shared and not reserved.
3. Open a penetration nominating `0438` (L3, Riser 2). Its sealant line reads "this site short 2 of 10" and opens the sealant's page at site B's section. Escalate it to purchasing with a note. State shows escalated. Back returns to the penetration. On the sites list, site B is still blocked: a decision does not create stock.
4. On that penetration, see candidates `0451` and `0464` labelled not verified. `0451` uses sealant, which this site is short of, and says so. Propose `0451` with a reason. It is listed as proposed and nothing else changes.
5. Open the penetration nominating `0344` (L5, Plant room). See "no catalogue match"; its sealant shortage is decided on the sealant's page. Go back to the sites list, open the menu and choose Materials: the pipe collar is on hand 2 against 6 planned across sites, short at site B, while site A on its own is not short.
6. Open site C. The Data problems chip counts four. The rows name the kind; each penetration page gives the reason, including two nominated solutions that do not fit (L1, Stair core: 0943's substrate is cut off in the catalogue; L1, Riser 1: needs 90 min insulation, 0435 claims 60). The Shortages chip shows the one stock-unknown penetration, never a clear status.
7. On site B's list, the escalated penetrations show the escalation mark. Open L3, Riser 2 and its Actions log tab: the escalation and the proposal, with date and author. Then open the menu and choose Actions log: every site's decisions, grouped by site.

## 10. Production gaps (carried to README)

No login or role checks, no rate limiting, TLS that encrypts but does not authenticate the database server, no offline support, stub upstream systems, shared unreserved stock, and no approval workflow.

## 11. Open points

- Whether "fire rating" in QAntum is the integrity and insulation pair (affects FR11).
- Who actually approves substitutes, and whether that queue exists.
- Which locations count as "in stock" for a leader.
- Whether a recurrence at the same shortfall needs a fresh decision (affects FR10).
