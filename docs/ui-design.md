# UI design

Proposed defaults for the three screens plus the actions log. Status: **approved 2026-10-04**. Requirements are in `slice-specification.md` (FR1 to FR16, AC 30 to 36), the API in `api.md`, terms in `glossary.md`. The screens were drawn for review in the conversation that produced this file.

## 1. Who and where

A team leader checks a site before the crew leaves, usually on a phone in a van or on site: one hand, bright light, maybe gloves. So: large targets, high contrast, plain words, one decision per screen.

## 2. Defaults

| Topic | Proposed default | Why |
| --- | --- | --- |
| Visual direction | Plain and utilitarian, neutral surfaces, no brand identity | We have no QAntum brand assets. A tool for the field should not compete with the information |
| Theme | Light by default, dark follows `prefers-color-scheme` | Both must pass contrast |
| Status | Icon plus text plus colour, never colour alone. Clear (green, check), Blocked (red, stop sign: an octagon with a bar), Nothing planned (grey, dashed circle), Unavailable (amber, warning) | AC 30, and glare |
| Typography | System font stack, 16px base, nothing under 12px | No font download, works offline of the network |
| Layout | Single column. Max width 720px, centred. Fits 375px with no horizontal scroll | AC 32 |
| Targets | At least 44px high and wide for anything tappable | AC 31 |
| Motion | None needed. Respect `prefers-reduced-motion` | |
| Demo honesty | A landing page at `/` ("Ready to send the crew?") explains the demo once: sample data, no login, shared decisions, nothing sent, and a five-step walkthrough. No screen carries a Demo tag (removed at the user's request, 2026-10-06) | One explanation in one place; the working screens stay uncluttered |
| Navigation | A slim sticky nav header, one row: the back control (a chevron and the name of the screen it returns to, "‹ Sites", "‹ Harbour Point, Levels 3 to 5", cut with an ellipsis when long, at least 44 high, accessible name "Back to <name>"). The page title is the page's one `h1`, first in `main`, shown in full and wrapping. The landing page has no header. No transition animation | A slim bar leaves room for the work while scrolling, and a site name is never cut, so two similar sites cannot look alike |
| Styling tech | CSS Modules and CSS custom properties. **No new dependencies** (no Tailwind, no component library) | Small app, nothing to justify a dependency. Tokens give one place for colours |
| Rendering | Next.js server components for pages, small client islands only for dialogs and forms | Less client code, no loading flicker, nothing secret in the browser |
| Data in pages | Server components call the application use cases through the composition root directly, not over HTTP | No self-request, faster, one fewer failure mode. Writes from the browser go through the real `/api` routes, so the API is still exercised end to end |

## 3. Routes and screens

| Route | Screen | Content |
| --- | --- | --- |
| `/` | About this demo | What the app is for, what is invented, the two-minute walkthrough, and a primary "Open sites" button in a full-width bar stuck to the bottom of the screen (the button fills it inside the side gutters, capped at the content width). No Demo tag (this is the page it links to) |
| `/sites` | Sites | One card per site with name and a crew status chip |
| `/sites/[id]` | Site: Shortages tab (default) | Header with back link, job ref with the planned work ("Job ref HP-345" then "12 penetrations, 5 solutions ›"), status banner, tab bar (Shortages, Data problems, Actions log, each with a count), then the stock notice, stock age and shortage cards |
| `/sites/[id]/data-problems` | Site: Data problems tab | Same frame; one card per blocker with its reason and an escalate action |
| `/sites/[id]/penetrations` | Penetrations (pushed in from the planned-work link, or filtered from a shortage card's "Affects N penetrations ›") | Back to the site, "12 penetrations, 5 solutions", the readiness banner, then every planned penetration grouped under its solution. Each row links to its substitutes and shows only per-penetration facts: a data problem's reason, "Uses short material: …", "Stock unknown: …". No ready marks |
| `/sites/[id]/penetrations/[pid]` | Penetration (title: the place) | Nominated solution: its data-problem and shortage status lines, then the penetration and the solution side by side with any field that does not fit marked (AC 36). Substitutes: the "Catalogue match, not verified" notice and one card per candidate with an availability chip and "Propose this", or the reason there are none and a full-width Escalate |
| `/sites/[id]/actions` | Site: Actions log tab | Same frame. Newest first: what was recorded, when, by whom, and whether it is current, earlier or resolved. Proposals listed separately |

There is also a not-found page and one error page with a retry link. All data pages are dynamic (never cached). The landing page has no data and is static.

### Site readiness banner

| Crew status | Banner text | Icon |
| --- | --- | --- |
| clear | Crew can go | check |
| blocked | Blocked: hold the crew. (The tab labels carry the counts of shortages and data problems; the sites list chip names them too.) | stop sign |
| nothing_planned | Nothing planned for this site | dashed circle |
| API 502 | Can't check this site right now. Don't assume it's clear. Try again. | warning |

### Shortage card

Material name, one line `Need X, have Y, short Z unit` (or `Need X, stock unknown` for an unknown-stock shortage), count of affected penetrations as a link to the Penetrations page filtered to that material, a state badge (Open, Waiting, Escalated, with "Earlier decision, shortfall has grown" when an action is not current), and two buttons: Wait and Escalate.

### Data problem card (blocker)

Plain reason: "Solution code 9999 isn't in the catalogue", "No materials recorded for solution 0393", "A material quantity is invalid for solution NNNN", "Solution NNNN doesn't fit this penetration: <fields>". Only an Escalate button (a wait makes no sense here). Same state badge.

### Decisions

- **Wait:** a small dialog with an optional note and the line "This does not release the crew."
- **Escalate:** a dialog with Purchasing or Warehouse (required, no default pre-chosen would cost taps, so Purchasing is preselected), an optional note with a character count out of 500, and the same line about the crew.
- **Propose a substitute:** a dialog with a required reason (1 to 500 characters after trimming) and the notice that a manager has to verify the match.
- Dialogs use the native `<dialog>` element, so focus is trapped and Escape closes.
- While submitting, the primary button shows "Sending…" and is disabled. The idempotency key is generated when the dialog opens, so a double tap or a retry reuses it.
- On success the dialog closes, the page refreshes, and a polite live region says "Escalation recorded" (or the equivalent). On a replay (200) it says "Already recorded".

### Empty and error states

| Situation | Message |
| --- | --- |
| No candidates (`ok`, empty) | With a related shortage or data problem: "No catalogue match for this penetration. Escalate instead." and an Escalate action. With none: "No catalogue match for this penetration." only, because there is nothing the API could escalate |
| `substrate_incomplete` | The catalogue entry for this substrate is incomplete, so we can't suggest substitutes. With a related data problem (pen-c-01), an Escalate action too. |
| `nominated_code_unknown` | The nominated solution isn't in the catalogue, so we can't suggest substitutes. |
| Candidate availability `no_material_mapping` | We can't tell if its materials are in stock. |
| Candidate availability `unknown` | No stock record for one of its materials. |
| Candidate availability `short` | Uses a material this site is short of. |
| Candidate availability `invalid_quantity` | Its material quantities look invalid. |
| Sites list empty | No sites to show. |
| Site `unavailable` in the list | Can't check |
| No actions yet | Nothing recorded for this site yet. |

### API error to message

| Code | Message shown |
| --- | --- |
| `validation_failed` | Check the highlighted fields. |
| `payload_too_large` | That's too long. Shorten it. |
| `shortage_not_found` | That shortage no longer exists. Refresh to see the latest. |
| `stale_nomination` | This penetration's nomination has changed. Refresh and try again. |
| `not_a_candidate` | That solution is no longer a candidate. Refresh and try again. |
| `idempotency_key_reused` | Something went wrong sending that. Close this and try again. |
| `upstream_unavailable`, `upstream_invalid` | A system we depend on isn't available. Nothing was recorded. Try again. |
| anything else | Something went wrong. Nothing was recorded. |

No raw error text from the server is ever shown.

## 4. Copy rules

Plain words, sentence case, no exclamation marks, no "please", no "successfully". Verb-first buttons: Wait, Escalate, Propose this, Send escalation, Cancel. The only fixed wordings from the API are kept exactly: "Catalogue match, not verified" and "On hand, shared, not reserved". The UI never says "compatible" or "approved".

## 5. Accessibility (WCAG 2.2 AA)

- One `h1` per page (first in `main`, not in the header), ordered headings, landmarks: one `banner` (the header, holding the back control, on inner screens) and one `main`.
- Status chips and banners carry text and an icon with `aria-hidden`, so colour is never the only signal.
- Visible focus ring on every control, logical tab order, dialogs return focus to the control that opened them.
- Form fields have visible labels, errors are announced next to the field, character counts are text.
- Contrast checked in light and dark for text, chips, banners and focus rings.
- Results are announced through a polite live region.
- `lang="en"`. Zoom to 200% without loss of function.

## 6. Structure and testing

Components live under `src/ui/` and views under `src/app/`. A small pure module maps domain status to label, icon name and tone, and a second maps API error codes to messages. Both are plain TypeScript with unit tests (no DOM library needed).

Browser tests use Playwright (already configured) with `@axe-core/playwright`:

- the demonstration scenario on a 375px viewport: open Harbour Point, escalate sealant, see it escalated and the crew still blocked, see substitutes for `0438`, propose `0451`, see it in the actions log, then open Kingsway Works and see the data problems
- keyboard-only completion of the escalate flow
- axe has no serious or critical violations on each screen in light and dark
- no horizontal scroll at 375px on each screen
- a forced failure: the stock stub down produces the "can't check" banner and never "Crew can go"

## 7. Decisions recorded on approval (2026-10-04)

1. The defaults above are approved as drawn.
2. Playwright Chromium is installed (`npx playwright install chromium`, about 363 MB on disk with the headless shell). It launches at a 375px viewport. The worker sandbox cannot install browsers, so this was done outside it.
3. `frontend-engineering` and `ui-portability-baseline` are added to the project profile.
4. The failure demo was not answered, so no fault switch is built. The "can't check this site" banner is verified in tests only. A preview-only switch remains an option.
5. Grok delegation uses the default model, without the fast flag.

## 8. Out of scope for this slice

Login, offline use, push notifications, editing or cancelling a recorded action, site search, and a map or floor plan view.

## 9. As built: changes after review (2026-10-04)

Three independent reviews of the built UI led to these changes to the design above. The wording is in `src/ui/messages.ts`.

| Topic | As built |
| --- | --- |
| Empty substitutes | The "Escalate instead" sentence and button appear only when the penetration is on a shortage or a data problem (see the table in section 3) |
| Sites list failure | Whole list fails: "Can't check the sites right now. Don't assume any site is clear. Try again." One site fails: chip "Can't check" |
| Data-problem only site | Same banner, "Blocked: hold the crew."; the Data problems tab count shows why. (Replaced the count-based sentences on 2026-10-06.) |
| Unreachable server | "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice." The retry reuses the dialog's idempotency key |
| Dialog while sending | Escape and Cancel cannot close it while a request is in flight. The response always refreshes the page and announces |
| Live region | In memory only. It starts empty on every full page load |
| Substitute cards | Material name and quantity per install only. On-hand counts are not shown there, because that screen has no shared-stock label |
| Unknown values | An unknown crew status shows the can't-check banner. An unknown shortage state or action status shows "Unknown", never "Escalated", "Resolved" or "Crew can go" |
| Character count | Counts the trimmed text, as the limit does |
| Inputs | A darker input border (at least 3:1 on both backgrounds) and a visible invalid state |
| Links | Data-problem cards link the penetration to its penetration page. Every unavailable screen keeps its back link |
| Error screens | `error.tsx` and `global-error.tsx` show fixed copy and a retry button, never the message or digest |

Navigation shell (same day, after a phone review): the demo bar moved to a sticky footer; a sticky header carries the title and, on inner screens, a chevron back row sits just below it, named after the parent screen, replacing the full-width Back button (the chevron first sat inside the header; moved below it after review); the site reference reads "Job ref RP-A2" and appears on the site screen only, under the title, where an escalation would quote it (removed from the list cards after review, 2026-10-06). The page scrolls as a whole (not an inner scroller), so the browser restores scroll position when going back. (Superseded: no demo bar or Demo tag; the title is in the page body.)

Usability round (2026-10-05, from a review against the exercise brief's UX question):

| Topic | As built |
| --- | --- |
| Sites list | A blocked chip says why: "Blocked · 2 shortages", "Blocked · 1 shortage, 4 data problems" |
| Stock age | "Stock figures from 3 Oct 2026, 08:00 UTC (2 days old)". Older than a day adds "These stock figures are more than a day old. Check with the warehouse before relying on them." Warning only; crew status is unchanged. Hidden on a nothing-planned site |
| Shortage state | Flat labels, not chips: "No decision yet", "Waiting", "Escalated" |
| Units | `each` is omitted ("short 2"); other units pluralise ("2 cartridges", "2.5 metres") |
| Penetrations | (Replaced 2026-10-06.) The card's "Affects N penetrations ›" is a 44px link to the Penetrations page filtered to that material (`?material=…`), which shows "Using {material} · n of total" and a Show all link. Rows there are grouped under "Solution 0438 · 4"; each row is "{floor}, {location} · {service} {size}" with "Substitutes ›" |
| Ratings | "Fire rating: 60 min integrity, 30 min insulation" (a missing part says "no insulation rating"). Candidates add "Supplier ref …" and "Meets the required rating" or "Below the required rating" against the penetration |
| Catalogue notice | "Catalogue match, not verified" only when at least one candidate is listed |
| Decisions | Wait and Escalate dialogs add "This records your decision here. Nobody is notified automatically yet." |
| Actions log | "Still applies" (neutral), "Shortfall has grown since" (warning), "Shortage resolved"; the repeated site name is gone |
| Failure | Every can't-check screen has a "Try again" button that reloads the page |

Limits recorded rather than built: an open tab keeps the banner it loaded until the next navigation; the three dialogs repeat their form code; no end-to-end test shows the "Earlier decision" badge (the sample stock cannot change during a run), which is covered at the API. From the usability review, not built: a separate escalation target for data problems (they are not a purchasing matter), a "substitute proposed" marker on shortage cards, a "what was checked" summary on a clear site, and a planned work date per site. Penetrations at the same place with the same service read the same (four in the sample); real data would add the floor-plan pin reference.

Landing page (2026-10-06, user decision): the bottom demo bar was replaced by a landing page at `/` and a Demo tag in every header. The sites list moved from `/` to `/sites`; every `/sites/...` URL is unchanged, and back links named "Sites" go to `/sites`. (Superseded: the Demo tag was later removed.)

Nav header (2026-10-06, user decision): the back control moved from a row below the header back into the sticky header, as the first of two rows. Site tabs (same day, user idea): `/sites/[id]` (Shortages), `/sites/[id]/data-problems` and `/sites/[id]/actions` share a frame with the job ref, the readiness banner and a tab bar with counts; the banner sits above the tabs on every tab.

Title and banner (2026-10-06, user decisions): the title moved from the header into the page body as the `h1`, shown in full, and the header became one slim row (back control and Demo tag). With tab counts in place, the site screen's banner became "Blocked: hold the crew."; AC 34 rewritten to match. (Superseded: the Demo tag was later removed; the header holds only the back control.)

Sticky tabs (2026-10-06, user decision): the site tab bar sticks directly below the nav header while scrolling, so the counts stay in view. The header has a fixed height (`--app-bar-height`) for that.

Kind icons (2026-10-06, user decision): small outline icons in the secondary text colour say what a thing is, never its state. They are decorative (`aria-hidden`) and use none of the status shapes (tick, stop sign, triangle, circle) or status colours.

| Kind | Icon | Where |
| --- | --- | --- |
| Site | building | sites list cards |
| Material shortage | box | shortage card titles |
| Data problem | document with a question mark | data problem card titles |
| Solution | shield | "Solution 0438 · 4" group headings, "Nominated solution", candidate titles |
| Decision | clipboard | actions log rows |

Not on penetration rows (too many; the solution heading above carries the shield), the tab bar (width at 375px), or banners and chips (those are status).

Stop icon (2026-10-06, user decision): blocked and short use a stop sign (octagon with a bar) instead of a cross, which read as "dismiss".

Planned work (2026-10-06, user decision): every site tab shows how much work the check covered next to the job ref, counted from the site's planned penetrations and their distinct nominated solutions. No line when nothing is planned. No per-penetration ready marks: stock is shared across the site, so no single penetration can honestly be called ready. A full Penetrations tab was considered and skipped for now.

Penetration list (2026-10-06, user decision): the planned-work counts on the site screen are a link ("12 penetrations, 5 solutions ›", a 44px target) that pushes in `/sites/[id]/penetrations`. Its rows reuse the shortage card's penetration rows (`PenetrationGroups`).

Shortage card links and Substitutes page (2026-10-06, user decisions): a shortage card no longer expands an inline penetration list; its affected count opens the Penetrations page filtered to that material (only a material that is a shortage on the site can filter; anything else shows the full list with a note, never an empty list). Data problem cards keep their direct link to the one penetration. The Substitutes page no longer has an Actions log button: the log is a tab on the site screen.

Penetration page (2026-10-06, user decisions): titled by the place, with three sections. Penetration: grey labels and values (Service, Required rating). Nominated solution: that solution's problems at this site as colour-coded status lines, each with an icon (data problem: red with a warning icon; uses a short material: red with a stop sign; stock unknown: amber). Substitutes: the not-verified notice and candidates, or the reason there are none as a status line, then Escalate as a full-width primary button. The Penetrations list uses the same status lines on its rows. (Superseded: the Penetration section was folded into the side-by-side comparison under Nominated solution; see "Demo tag removed and solution fit" below.)

Actions log links (2026-10-06, user decision): an entry's title links to the work it is about. A proposal and a data problem decision open their penetration's page; a material shortage decision opens the Penetrations list filtered to that material, and has no link once the shortage is resolved. Proposals name their place: "Proposed substitute for L3, Riser 2: 0438 to 0451".

Decision colours (2026-10-06, user decision): Waiting and Escalated were both amber with a warning triangle. A decision is neither "can go" nor an alarm, so each now has its own colour and icon, outside the crew-status colours:

| State | Colour | Icon |
| --- | --- | --- |
| No decision yet | grey | dashed circle |
| Waiting | blue (`--info-*`) | clock |
| Escalated | purple (`--escalation-*`) | up arrow |
| Earlier decision, shortfall has grown | amber | warning |

The Wait and Escalate buttons carry the same icons but stay neutral (Escalate is primary only where it is a page's main action). Logged waits and escalations show the decision's icon in its colour; proposals keep the decision kind icon. Both new colour pairs are at least 4.5:1 against their chip background, the page and the card surface, in light and dark (a unit test checks it).

Demo tag removed and solution fit (2026-10-06, user decisions): the Demo tag is gone from every header; top-level screens have no header. On the penetration page, the Nominated solution section shows the penetration and the solution side by side (orientation, substrate, service, size, integrity, insulation, supplier ref); a field that does not fit reads "…, doesn't fit" with a stop sign. A nominated solution that does not fit is also a data problem (AC 35, 36).

Cut-off substrates (2026-10-06, user decision, option A): a substrate cut off after the family name never fits, on either side. The comparison shows why rather than two identical texts: "FR plasterboard, (cut off)" against "FR plasterboard, (cut off in the catalogue), doesn't fit".
