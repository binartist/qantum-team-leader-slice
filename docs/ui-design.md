# UI design

Proposed defaults for the three screens plus the actions log. Status: **approved 2026-10-04**. Requirements are in `slice-specification.md` (FR1 to FR15, AC 30 to 32), the API in `api.md`, terms in `glossary.md`. The screens were drawn for review in the conversation that produced this file.

## 1. Who and where

A team leader checks a site before the crew leaves, usually on a phone in a van or on site: one hand, bright light, maybe gloves. So: large targets, high contrast, plain words, one decision per screen.

## 2. Defaults

| Topic | Proposed default | Why |
| --- | --- | --- |
| Visual direction | Plain and utilitarian, neutral surfaces, no brand identity | We have no QAntum brand assets. A tool for the field should not compete with the information |
| Theme | Light by default, dark follows `prefers-color-scheme` | Both must pass contrast |
| Status | Icon plus text plus colour, never colour alone. Clear (green, check), Blocked (red, cross), Nothing planned (grey, dashed circle), Unavailable (amber, warning) | AC 30, and glare |
| Typography | System font stack, 16px base, nothing under 12px | No font download, works offline of the network |
| Layout | Single column. Max width 720px, centred. Fits 375px with no horizontal scroll | AC 32 |
| Targets | At least 44px high and wide for anything tappable | AC 31 |
| Motion | None needed. Respect `prefers-reduced-motion` | |
| Demo honesty | A permanent small banner on every screen: "Demo: sample data, no login" | The app is a demonstration. Do not let it look like production |
| Styling tech | CSS Modules and CSS custom properties. **No new dependencies** (no Tailwind, no component library) | Small app, nothing to justify a dependency. Tokens give one place for colours |
| Rendering | Next.js server components for pages, small client islands only for dialogs and forms | Less client code, no loading flicker, nothing secret in the browser |
| Data in pages | Server components call the application use cases through the composition root directly, not over HTTP | No self-request, faster, one fewer failure mode. Writes from the browser go through the real `/api` routes, so the API is still exercised end to end |

## 3. Routes and screens

| Route | Screen | Content |
| --- | --- | --- |
| `/` | Sites | Demo banner, one card per site with name, reference and a crew status chip |
| `/sites/[id]` | Site readiness | Back link, site name, status banner, stock notice and "as of" time, shortage cards, a separate "Data problems" section for blockers, link to the actions log |
| `/sites/[id]/penetrations/[pid]` | Substitutes | Penetration summary, the "Catalogue match, not verified" notice, one card per candidate with an availability chip, "Propose this" |
| `/sites/[id]/actions` | Actions log | Newest first: what was recorded, when, by whom, and whether it is current, earlier or resolved. Proposals listed separately |

There is also a not-found page and one error page with a retry link. All pages are dynamic (never cached).

### Site readiness banner

| Crew status | Banner text | Icon |
| --- | --- | --- |
| clear | Crew can go | check |
| blocked | Blocked: N shortages (and M data problems when present). Hold the crew until stock arrives. | cross |
| nothing_planned | Nothing planned for this site | dashed circle |
| API 502 | Can't check this site right now. Don't assume it's clear. Try again. | warning |

### Shortage card

Material name, one line `Need X, have Y, short Z unit` (or `Need X, stock unknown` for an unknown-stock shortage), count of affected penetrations (expandable to a list with floor and location, each linking to its substitutes screen), a state badge (Open, Waiting, Escalated, with "Earlier decision, shortfall has grown" when an action is not current), and two buttons: Wait and Escalate.

### Data problem card (blocker)

Plain reason: "Solution code 9999 isn't in the catalogue", "No materials recorded for solution 0393", "A material quantity is invalid for solution NNNN". Only an Escalate button (a wait makes no sense here). Same state badge.

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
| `substrate_incomplete` | The catalogue entry for this substrate is incomplete, so we can't suggest substitutes. |
| `nominated_code_unknown` | The nominated solution isn't in the catalogue, so we can't suggest substitutes. |
| Candidate availability `no_material_mapping` | We can't tell if its materials are in stock. |
| Candidate availability `unknown` | No stock record for one of its materials. |
| Candidate availability `short` | Some of its materials are short. |
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

- One `h1` per page, ordered headings, landmarks (`header`, `main`).
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
| Data-problem only site | "Blocked: N data problem(s). Hold the crew until they are sorted." With any shortage the original sentence is kept |
| Unreachable server | "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice." The retry reuses the dialog's idempotency key |
| Dialog while sending | Escape and Cancel cannot close it while a request is in flight. The response always refreshes the page and announces |
| Live region | In memory only. It starts empty on every full page load |
| Substitute cards | Material name and quantity per install only. On-hand counts are not shown there, because that screen has no shared-stock label |
| Unknown values | An unknown crew status shows the can't-check banner. An unknown shortage state or action status shows "Unknown", never "Escalated", "Resolved" or "Crew can go" |
| Character count | Counts the trimmed text, as the limit does |
| Inputs | A darker input border (at least 3:1 on both backgrounds) and a visible invalid state |
| Links | Data-problem cards link the penetration to its substitutes screen. Every unavailable screen keeps its back link |
| Error screens | `error.tsx` and `global-error.tsx` show fixed copy and a retry button, never the message or digest |

Limits recorded rather than built: an open tab keeps the banner it loaded until the next navigation; the three dialogs repeat their form code; no end-to-end test shows the "Earlier decision" badge (the sample stock cannot change during a run), which is covered at the API.
