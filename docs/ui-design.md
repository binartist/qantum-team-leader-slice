# UI design

Proposed defaults for the screens and the actions log. Status: **approved 2026-10-04**. Requirements are in `slice-specification.md` (FR1 to FR17, AC 30 to 44), the API in `api.md`, terms in `glossary.md`. The screens were drawn for review in the conversation that produced this file.

## 1. Who and where

A team leader checks a site before the crew leaves, usually on a phone in a van or on site: one hand, bright light, maybe gloves. So: large targets, high contrast, plain words, one decision per screen.

## 2. Defaults

| Topic | Proposed default | Why |
| --- | --- | --- |
| Visual direction | Plain and utilitarian, neutral surfaces, no brand identity | We have no QAntum brand assets. A tool for the field should not compete with the information |
| Theme | System by default: light, or dark when the device prefers it (`prefers-color-scheme`). The menu's foot has a Theme choice (System, Light, Dark) as one segmented radio group; Light or Dark pins `data-theme` on `<html>` and is remembered in this browser only (`team-leader:theme`, the app's only browser storage), stamped by a head script before first paint so a dark page never flashes light | Both must pass contrast |
| Status | Icon plus text plus colour, never colour alone. Clear (green, check), Blocked (red, stop sign: an octagon with a bar), Nothing planned (grey, dashed circle), Unavailable (amber, warning) | AC 30, and glare |
| Typography | System font stack, 16px base, nothing under 12px | No font download, works offline of the network |
| Layout | Single column. Max width 720px, centred. Fits 375px with no horizontal scroll | AC 32 |
| Targets | At least 44px high and wide for anything tappable | AC 31 |
| Motion | None needed. Respect `prefers-reduced-motion` | |
| Demo honesty | A landing page at `/` ("Ready to send the crew?") explains the demo once: sample data, no login, shared decisions, nothing sent, and a five-step walkthrough. No screen carries a Demo tag (removed at the user's request, 2026-10-06) | One explanation in one place; the working screens stay uncluttered |
| Navigation | A slim sticky nav header, one row: the back control (a chevron and the name of the screen it returns to, "‹ Sites", "‹ Harbour Point, Levels 3 to 5", cut with an ellipsis when long, at least 44 high, accessible name "Back to <name>"). The landing page and the three top-level pages, Sites, Materials and Actions log, lead with a menu control instead (never both): it opens a left drawer ("Team leader", then Sites, Materials and Actions log with their kind icons, then the Theme choice and "About this demo" with a page icon at the foot, and the open page marked; rows at least 44 high; a native modal dialog, so Escape and the focus trap are the browser's; a tap on the backdrop (a press that starts there), the dismiss icon (accessible name "Close menu") or a link shuts it, and focus returns to the menu control; it slides in unless reduced motion is set; off-canvas at every width). The page title is the page's one `h1`, first in `main`, shown in full and wrapping. When the screen the back control names is the one underneath, the control pops that history entry, so the page returns at once instead of loading again; opened directly, or from another screen, it follows the link. No other transition animation | A slim bar leaves room for the work while scrolling, and a site name is never cut, so two similar sites cannot look alike |
| Styling tech | CSS Modules and CSS custom properties. **No new dependencies** (no Tailwind, no component library) | Small app, nothing to justify a dependency. Tokens give one place for colours |
| Rendering | Next.js server components for pages, small client islands only for dialogs, forms and the back control | Less client code, no loading flicker, nothing secret in the browser |
| Data in pages | Server components call the application use cases through the composition root directly, not over HTTP | No self-request, faster, one fewer failure mode. Writes from the browser go through the real `/api` routes, so the API is still exercised end to end |

## 3. Routes and screens

| Route | Screen | Content |
| --- | --- | --- |
| `/` | About this demo | Header with the menu control (About this demo is the current item). What the app is for, what is invented, "Finding your way" (the menu and its pages, the back control, filter chips and decision chips), and the two-minute walkthrough. The pages it names are inline links (Sites, Materials, Actions log, Harbour Point, L3, Riser 2, Kingsway Works filtered to data problems). No Demo tag (this is the page the menu links to) |
| `/sites` | Sites | Header with the menu control. One card per site with name and a crew status chip |
| `/materials` | Materials | Header with the menu control. "On hand, shared, not reserved", the stock age, a warning when any site could not be checked, then one row per material any site plans to use, by name, marked with the material kind icon: the on-hand amount and every site's need added up ("On hand 2 · planned across sites 6"; with stock unknown only the need, and a "Stock unknown · needed at N sites" chip), then "Short at N sites" (danger chip), or "N sites couldn't be checked" (warning), or "Sites together need more than on hand" (warning, when no site is short alone but the shared stock does not cover them all), or "Not short at any site" as plain text. Each row opens the material page. The total is left out when a site could not be checked; the banner then says "1 site couldn't be checked. Its needs are not counted.", and an empty list says "No materials planned at the sites that could be checked." With no stock read (nothing planned), the stock notice and age are not shown. If the stock cannot be read: "Can't check stock right now. Don't assume any material is in stock. Try again." |
| `/materials/[materialId]` | Material (title: its name) | Two tabs under the title, as on the penetration page: Stock (default) and Actions log (`?tab=log`, keeping `from` and `fromLog`). Actions log: every site's waits and escalations on this material, newest first, each with "At {site}" and no link; a count only when every site was read; an unreadable site is named in a warning; none readable: "We can't load this material's actions right now. Try again shortly."; empty: "Nothing recorded for this material yet." Stock tab: header with the back control: "‹ L3, Riser 2" when opened from that penetration's shortage line (`?from=<penetration>`, checked against the sites that plan the material), otherwise "‹ Materials". "On hand, shared, not reserved", the on-hand amount against the across-sites need, the stock age and stale warning, then one section per site that plans the material (`#site-<id>`), in site order: the site name, with the site icon, as a link up to the site (`?fromMaterial=` so that site's back control returns here), then "Needs 4, short 2" (danger), "Needs 1, stock unknown" (warning) or "Needs 2, not short for this site alone" (text), the places as text with the penetration icon and identical ones grouped ("L3, Riser 2 · PEX Pipe Ø25mm ×4"), and, only where the site is short, "For all N penetrations at this site", the "Earlier decision, shortfall has grown" warning when it applies, Wait and Escalate (no Waiting or Escalated label; the decisions are on the Actions log tab) (accessible names name the material and the site). A site that could not be checked comes last and says so. A material no site plans is not found |
| `/sites/[id]` | Site | Header with back link (to Sites, or to the material page when opened with `?fromMaterial=`) Job ref and the planned work as text ("Job ref HP-345" then "12 penetrations, 5 solutions"). A clear site has the "Crew can go" banner. A blocked site has no summary banner. Then the stock notice and stock age (hidden when nothing is planned), then a "Penetrations" heading with the total number of planned penetrations, then filter chips (Shortages, Data problems, Acted), which stick directly under the header while the list scrolls. The heading counts the whole list; the chips count subsets. Acted is a wait, an escalation or a proposed substitute. `?show=escalated` and `?show=waited` still select it. Each chip counts penetrations and toggles `?show=` (more than one is a union; none shows the whole list). The list is every planned penetration, one row each in place order. A row starts with the penetration icon and links to its substitutes and shows icon marks, inside the link, for the kind of each problem (Unknown solution, Doesn't fit, No materials, Invalid quantity, Short material, Stock unknown) and then the decisions in its Actions log (Escalated, Waiting, Proposed substitute with a swap icon in neutral), in their tone colours. A problem shows its count when it repeats; a decision always shows its count, and the three add up to the penetration's Actions log tab. If the log cannot be read, rows show problems only, under "Can't check decisions right now. Rows don't show them." Each mark's full wording ("Short material × 2", "Escalated") is its hidden label and its hover title; the marks are not controls; the penetration page carries the reason, the figures and the links to material pages. No ready marks. `?material=` narrows to one shortage and can be combined with the chips. An empty chip result says "No penetrations match these filters." |
| `/sites/[id]/data-problems` | Redirect | To `/sites/[id]?show=data-problems` |
| `/sites/[id]/penetrations` | Redirect | To the site page, keeping `?material=` |
| `/sites/[id]/penetrations/[pid]` | Penetration (title: the place) | Same header. Under the title, two tabs as links: Solution (default) and Actions log with a count (`?tab=log`; they keep `fromLog`). The tab bar splits the width in two over one rule; the current tab is underlined in the link colour, with its count tinted, and the panel below has no second rule. Actions log: this penetration's decisions and proposals, newest first, as in `/actions`; a material decision whose shortage is current adds "Applies to all N penetrations at this site" and opens the material page with `?from=` (back returns to the tab); data-problem decisions and proposals have no link; empty: "Nothing recorded for this penetration yet."; unreadable: no count and "We can't load this penetration's actions right now. Try again shortly." Solution tab: nominated solution: its data-problem and shortage status lines (a shortage reads "Short material: <name> · this site short 2 of 4", or "Stock unknown: <name> · this site needs 1", and links to the material page at this site's section with `?from=` this penetration; a substitute's line links the same way only when the site is already short of that material), then the penetration and the solution side by side with any field that does not fit marked (AC 36). Substitutes: the "Catalogue match, not verified" notice, then one candidate at a time (short-material lines, comparison table) and "Propose this". When more than one candidate exists, a "Select candidate" menu (a styled native select; the closed control shows the solution shield and "Solution 0451") is the title and switches candidate. A single candidate keeps the "Solution {code}" heading with the shield. Or the reason there are none. A data problem offers Escalate here, including when candidates exist. A material shortage is decided on its stock page |
| `/sites/[id]/materials/[materialId]` | Redirect | To `/materials/[materialId]#site-<id>` (AC 41) |
| `/actions` | Actions log | Header with the menu control. One section per site in site order (`#site-<id>`), headed by the site icon and name as a link to the site, which sticks under the header while that site's entries scroll; inside, "Recorded actions" then "Proposed substitutes", newest first, or "Nothing recorded for this site yet." A site whose log cannot be read says "We can't check this site's actions right now."; with none readable the page says "We can't load the actions log right now. Try again shortly." A material decision opens the material page at that site's section, a data-problem decision or proposal opens its penetration, a resolved decision has no link. Every link out carries `?fromLog=<site>`, so the opened page's back control reads "‹ Actions log" and returns to `/actions#site-<id>`, popping the log when it is the page underneath; the site page's filter chips keep it |
| `/sites/[id]/actions` | Redirect | To `/actions#site-<id>` |

There is also a not-found page and one error page with a retry link. All data pages are dynamic (never cached on the server). Moving from one screen to another keeps the page you are on until the next one is ready; there is no full-page Loading screen in between. A short-material link prefetches its material page. The landing page has no data and is static.

### Site readiness banner

| Crew status | Banner text | Icon |
| --- | --- | --- |
| clear | Crew can go | check |
| blocked | No banner on the site screen. The row lines are the status. The sites list chip still says "Blocked" and names the shortage and data-problem counts. | stop sign, on the sites list and on each row |
| nothing_planned | Nothing planned for this site | dashed circle |
| API 502 | Can't check this site right now. Don't assume it's clear. Try again. | warning |

### Shortage (a site's section on the material page)

The site name, `Needs X, short Z unit` (or `Needs X, stock unknown`), the places that use it with identical ones grouped, "For all N penetrations at this site", a state label (No decision yet, Waiting, Escalated, with "Earlier decision, shortfall has grown" when an action is not current), and two buttons: Wait and Escalate. On the penetration page the same shortage is one line, "Short material: <name> · this site short Z of X", linking here.

### Data problem (on the penetration page)

Plain reason: "Solution code 9999 isn't in the catalogue", "No materials recorded for solution 0393", "A material quantity is invalid for solution NNNN", "Solution NNNN doesn't fit this penetration: <fields>". Only an Escalate button (a wait makes no sense here), with the same state label.

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
| No candidates (`ok`, empty) | With a data problem on the penetration: "No catalogue match for this penetration. Escalate instead." and an Escalate action. Otherwise (including a shortage, which is decided on its material page): "No catalogue match for this penetration." only, because there is nothing the API could escalate |
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

- the demonstration scenario on a 375px viewport: open Harbour Point, escalate sealant, see it escalated and the crew still blocked, see substitutes for `0438`, propose `0451`, see it in the actions log from the menu, then open Kingsway Works and see the data problems
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
| Empty substitutes | The "Escalate instead" sentence and button appear only when the penetration has a data problem (see the table in section 3) |
| Sites list failure | Whole list fails: "Can't check the sites right now. Don't assume any site is clear. Try again." One site fails: chip "Can't check" |
| Data-problem only site | No banner; the Data problems chip count shows why, and the sites list chip names the counts. |
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
| Penetrations | The site page lists them, grouped under "Solution 0438 · 4". Each row is "{floor}, {location} · {service} {size}" with "Substitutes ›". `?material=` shows "Using {material} · n of total" and a Show all link |
| Ratings | "Fire rating: 60 min integrity, 30 min insulation" (a missing part says "no insulation rating"). Candidates add "Supplier ref …" and "Meets the required rating" or "Below the required rating" against the penetration |
| Catalogue notice | "Catalogue match, not verified" only when at least one candidate is listed |
| Decisions | Wait and Escalate dialogs add "This records your decision here. Nobody is notified automatically yet." |
| Actions log | "Still applies" (neutral), "Shortfall has grown since" (warning), "Shortage resolved"; the repeated site name is gone |
| Failure | Every can't-check screen has a "Try again" button that reloads the page |

Limits recorded rather than built: an open tab keeps the banner it loaded until the next navigation; the three dialogs repeat their form code; no end-to-end test shows the "Earlier decision" badge (the sample stock cannot change during a run), which is covered at the API. From the usability review, not built: a separate escalation target for data problems (they are not a purchasing matter), a "substitute proposed" marker on shortage cards, a "what was checked" summary on a clear site, and a planned work date per site. Penetrations at the same place with the same service read the same (four in the sample); real data would add the floor-plan pin reference.

Landing page (2026-10-06, user decision): the bottom demo bar was replaced by a landing page at `/` and a Demo tag in every header. The sites list moved from `/` to `/sites`; every `/sites/...` URL is unchanged, and back links named "Sites" go to `/sites`. (Superseded: the Demo tag was later removed.)

Nav header (2026-10-06, user decision): the back control moved from a row below the header back into the sticky header, as the first of two rows. Site tabs (same day, user idea): `/sites/[id]` (Shortages), `/sites/[id]/data-problems` and `/sites/[id]/actions` share a frame with the job ref, the readiness banner and a tab bar with counts; the banner sits above the tabs on every tab. (Superseded: see "Site list and actions panel" and "Drawer and materials".)

Title and banner (2026-10-06, user decisions): the title moved from the header into the page body as the `h1`, shown in full, and the header became one slim row (back control and Demo tag). With tab counts in place, the site screen's banner became "Blocked: hold the crew."; AC 34 rewritten to match. (Superseded: the Demo tag was later removed; the header holds only the back control.)

Sticky tabs (2026-10-06, user decision): the site tab bar sticks directly below the nav header while scrolling, so the counts stay in view. The header has a fixed height (`--app-bar-height`) for that. (Superseded: see "Site list and actions panel" and "Drawer and materials".)

Kind icons (2026-10-06, user decision): small outline icons in the secondary text colour say what a thing is, never its state. They are decorative (`aria-hidden`) and use none of the status shapes (tick, stop sign, triangle, circle) or status colours.

| Kind | Icon | Where |
| --- | --- | --- |
| Site | building | sites list cards |
| Material | box | materials list rows |
| Solution | shield | "Nominated solution", a single substitute's heading, and the Select candidate control when that menu is the title |
| Decision | clipboard | actions log rows |
| Penetration | an opening with a service through it | penetration list rows |
| About | a page | the side menu's "About this demo" |

Not on the filter chips (width at 375px), or on banners and status chips (those are status).

Stop icon (2026-10-06, user decision): blocked and short use a stop sign (octagon with a bar) instead of a cross, which read as "dismiss".

Planned work (2026-10-06, user decision): every site tab shows how much work the check covered next to the job ref, counted from the site's planned penetrations and their distinct nominated solutions. No line when nothing is planned. No per-penetration ready marks: stock is shared across the site, so no single penetration can honestly be called ready. A full Penetrations tab was considered and skipped for now. (Superseded: see "Site list and actions panel" and "Drawer and materials".)

Penetration list (2026-10-06, user decision): the planned-work counts on the site screen are a link ("12 penetrations, 5 solutions ›", a 44px target) that pushes in `/sites/[id]/penetrations`. Its rows reuse the shortage card's penetration rows (`PenetrationGroups`). (Superseded: see "Site list and actions panel" and "Drawer and materials".)

Shortage card links and Substitutes page (2026-10-06, user decisions): a shortage card no longer expands an inline penetration list; its affected count opens the Penetrations page filtered to that material (only a material that is a shortage on the site can filter; anything else shows the full list with a note, never an empty list). Data problem cards keep their direct link to the one penetration. The Substitutes page no longer has an Actions log button: the log is a tab on the site screen. (Superseded: see "Site list and actions panel" and "Drawer and materials".)

Penetration page (2026-10-06, user decisions): titled by the place, with three sections. Penetration: grey labels and values (Service, Required rating). Nominated solution: that solution's problems at this site as colour-coded status lines, each with an icon (data problem: red with a warning icon; uses a short material: red with a stop sign; stock unknown: amber). A "Short material" line is a link to `/sites/[id]/materials/[materialId]`. Stock unknown stays text. Substitutes: the not-verified notice and candidates, or the reason there are none as a status line, then Escalate as a full-width primary button. The Penetrations list uses the same status lines on its rows, and the short-material line is its own link beside the row (the row is already the link to the penetration). (Superseded: the Penetration section was folded into the side-by-side comparison under Nominated solution; see "Demo tag removed and solution fit" below.)

Material stock page (2026-10-06, user decision): the red short-material line opens one material's stock at this site. It shows the amount (`Need X, have Y, short Z`, or `Need X, stock unknown`), the shared-stock notice and the stock age, then how many planned penetrations use it and those places, written as text so the page does not link back to the penetration that opened it. A material that is not a shortage here shows "That material is not a shortage on this site." and no amounts, so a resolved shortage never reads as zero. Wait, Escalate and the decision state live on this page (added when the shortage cards left the site screen). Scoped (2026-10-06, user decisions): a shortage is per site and material, so one wait or escalate covers every penetration that needs it, and the page says so ("For all 4 penetrations at this site"). The need line and the places heading name the site, because the stock on hand is shared with other sites. The places stay text (row links would be circular) with identical ones grouped, and one link goes up to the site list filtered to the material. (Superseded: the page is now across sites; see "Drawer and materials" below.)

Site list and actions panel (2026-10-06, user decision): the site screen is the penetration list. Shortages, data problems and acted are filter chips (toggle links, union, counts are penetrations, including zero; no number when readiness is unknown). The chip row sticks under the header. Acted matches a penetration when a shortage that lists it, or its data problem, is waiting or escalated, and it counts once. A blocked site has no summary banner, because each row already shows its shortage or data problem. Row chips name only the kind of problem ("Unknown solution", "Doesn't fit", "No materials", "Invalid quantity", "Short material", "Stock unknown", with "× N" when a row has several); the penetration page carries the full reason and the links to stock pages. A clear site still says "Crew can go." Unknown stock is a row line, never a clear status. The planned-work line is text. `/penetrations` redirects here and keeps `?material=`; `/data-problems` redirects to `?show=data-problems`; `/actions` redirects to `?log=open`. The actions log is a header button on the site and penetration pages. It opens a right-hand panel (full width at 375px) with the same recorded actions and proposals. A shortage's Wait and Escalate are on its stock page. A data problem's Escalate stays on the penetration page, including when substitutes are listed.

Actions log links (2026-10-06, user decision): an entry's title links to the work it is about. A proposal and a data problem decision open their penetration's page; a material shortage decision opens the site screen filtered to that material (`?material=`), and has no link once the shortage is resolved. Proposals name their place: "Proposed substitute for L3, Riser 2: 0438 to 0451".

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

Drawer and materials (2026-10-06, user decisions): a drawer side menu, after the user's other apps, gives the two top-level views, Sites and Materials. Stock is shared, so the material view is across sites: `/materials` lists each planned material against the one stock with the across-sites total, and `/materials/[id]` has one section per site, where that site's shortage is waited on or escalated (a shortage is a site's need for a material, so one decision covers all its penetrations). The site-scoped material page became a redirect. The penetration page briefs each shortage inline and links to the material page; the back control there returns to the penetration (`?from=`), because after a sideways jump a parent-named back control would land on the wrong page. (This supersedes the material stock page notes above.)

Back pop (2026-10-06, user decision): the back control was a fresh visit, so the root Loading screen replaced the page until the dynamic screen rendered. It is still a link to the named screen. When that screen is the history entry underneath, the control pops it and the page returns at once. No extra transition animation.

Opening a material page (2026-10-06, user decision): the short-material link was a new visit to a dynamic page, so that same Loading screen replaced the penetration until the material page rendered. The Loading screen is removed. The penetration stays in place until the material page is ready, and the link prefetches that page.

Substitute title (2026-10-06, user decision): when the Select candidate menu is shown, the "Solution {code}" heading under it is removed. The solution shield sits on the closed control, beside the selected name. The open native list stays text, because an option cannot hold the icon. One candidate still has the heading and the shield. The comparison table's "Solution {code}" column header stays. The menu label is "Select candidate".

Penetration list title (2026-10-06, user decision): the site screen has a "Penetrations" heading above the filter chips, with the total number of planned penetrations. The chips still count subsets and stick under the header; the heading scrolls away with the page. Each row starts with the penetration icon.

Material page sites (2026-10-06, user decision): each site heading has the site icon and each place has the penetration icon. The site link opens that site, and the site's back control returns to this material page. When the material page is the screen underneath, the control pops it. A direct visit to the site URL still follows the link. A missing, repeated or unknown `fromMaterial` leaves the back control on Sites. Filter chips keep `fromMaterial`. Places stay text.

Side menu (2026-10-06, user decision): the drawer's Close label is a dismiss icon. Its accessible name stays "Close menu". Sites, Materials, Actions log and About this demo each start with an icon.

Landing page menu (2026-10-06, user decision): the landing page uses the same menu header as Sites and Materials. About this demo is the current item. The sticky "Open sites" bar is gone; Sites in the drawer is the way onto the list.
Actions log in the menu and decision popovers (2026-10-06, user decision): the header Actions log button and its panel are gone, because a header control did not say which work it belonged to and its links went sideways. The log is a top-level page in the side menu, one section per site. A decision shows where it applies: a list row's Escalated or Waiting chip is a button beside the row's link (never inside it) that opens the latest decision in a native popover. `?log=open` no longer does anything. (This supersedes the actions panel parts of "Site list and actions panel" and "Actions log links".)

Actions log follow-ups (2026-10-07, user decision): each site heading on the log has the site icon and sticks under the header while its entries scroll. A page opened from the log returns to it: links carry `?fromLog=<site>`, honoured only when it names that page's own site (or, on a material page, one of its sites), and the back control then reads "‹ Actions log" and pops the log when it is underneath, like the material page's back control on a site. A material page opened from a penetration still returns to the penetration first.

Row marks and penetration tabs (2026-10-07, user decision): the row chips were too heavy, so each problem and decision is an icon mark with its count, inside the row link, with the full wording as its hidden label and hover title. The decision popover is gone. A penetration's decisions are on its own page, in an Actions log tab beside the Solution tab. (This supersedes the decision chip and popover in "Actions log in the menu and decision popovers".)

Material tabs and decision counts (2026-10-07, user decisions): decisions are made on materials and solutions, so the material page has Stock and Actions log tabs like the penetration page. The Waiting and Escalated labels on its site sections are gone, for one design across pages: a page's decisions are in its Actions log tab. The "Earlier decision, shortfall has grown" warning stays, because it asks for a new decision. Row decision marks show their numbers, including proposals, and Acted includes a proposed substitute.
