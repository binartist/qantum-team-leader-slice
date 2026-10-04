# UI spec and design conformance

Lens: built UI against `docs/ui-design.md`, FR1–FR16 and AC 1–32 in `docs/slice-specification.md`, and `docs/api.md`.

No Critical findings. The UI does not say "compatible" or "approved", does not render "Crew can go" on an upstream failure, and does not show raw server error text.

## Findings

### High

1. **High** — `src/app/sites/[id]/penetrations/[pid]/page.tsx:48` and `:68-76`
   The empty-candidate screen says "Escalate instead" and then omits the Escalate control whenever that penetration is not already on a shortage or a blocker.
   FR13, AC 20, and the design empty-state row ("with an Escalate action") require the offer for an `ok` result with no candidates. The canonical fixture is site A penetration `pen-a-01` (nominated `0344`): `listCandidates` returns `status: "ok"`, `candidates: []`, and `getSiteReadiness` returns `crewStatus: "clear"` with no shortages and no blockers, so `relatedDecisions` is `[]` and `EscalateDialog` is not rendered. The visible sentence is still "No catalogue match for this penetration. Escalate instead." Site B `pen-b-10` (also `0344`) does get a button, because it sits on `site-b:MAT-SEALANT`. `tests/api/routes.test.ts:419` is titled AC 20 and only asserts the JSON list is empty, so it cannot fail when the button is missing.
   Suggested fix: on `ok` with an empty candidate list, always render an Escalate control. `pen-a-01` has no shortage id the API will accept, so the control needs a real target or the sentence has to wait until one exists. Add a page-level test for `/sites/site-a/penetrations/pen-a-01` that fails when no Escalate button is present.

### Medium

2. **Medium** — `src/ui/messages.ts:62-67`
   AC 9 requires the UI to show "stock unavailable" when stock fails. That phrase is not in the UI. The banner string is the approved design's 502 line: "Can't check this site right now. Don't assume it's clear. Try again."
   `docs/slice-specification.md:53` and `docs/ui-design.md:43` disagree. The spec's own rule is to fix the spec first. Fail-closed behaviour holds: the unavailable branch does not use "Crew can go" (`src/app/sites/[id]/page.tsx:53-60`, `src/app/_lib/load.ts:13`).
   Suggested fix: change AC 9 to the approved banner sentence. Leave the UI string as it is.

3. **Medium** — `src/app/page.tsx:18-19` (text from `src/ui/messages.ts:62-67`)
   A failure of the sites list renders the single-site banner, including the words "this site".
   `readinessBanner("unavailable", 0, 0)` is the site-readiness 502 row. On `/` it is the only content when `listSites` throws `UpstreamError`. The per-site chip for one bad site is the design's "Can't check" (`src/ui/status.ts:21`), which is the right list treatment. The whole-list failure is a different screen and still talks about one site.
   Suggested fix: give the sites list its own unavailable sentence that still tells the leader not to treat any site as clear, and keep "Can't check" for a single `unavailable` chip.

4. **Medium** — `src/app/sites/[id]/penetrations/[pid]/page.tsx:41`, `:44`, `:51`, and `:100-106`; `src/app/sites/[id]/actions/page.tsx:38-44`
   An upstream failure removes the back link that the same screen shows on success.
   `unavailable()` returns a heading and the 502 banner and no link. That runs when the site lookup fails and when candidates (or the readiness lookup used for Escalate) fail, including after the site name is already known. The site readiness page keeps "Back to sites" on both unavailable branches (`src/app/sites/[id]/page.tsx:44` and `:57`). The actions page drops the link only when the site lookup fails; a later actions failure still has "Back to site" (`src/app/sites/[id]/actions/page.tsx:51`).
   Suggested fix: keep the same back link on the unavailable branch, using `/` when the site id did not resolve.

5. **Medium** — `src/ui/BlockerCard.tsx:25-35` and `src/app/sites/[id]/page.tsx:99-117`
   Data-problem penetrations have no link to the substitutes screen, so the design's `nominated_code_unknown` message is only reachable by typing the URL.
   Shortage rows link each affected penetration (`src/ui/ShortageCard.tsx:47`). Blocker cards render the place as plain text. Sample evidence: `pen-c-03` (`9999`) and `pen-c-04` (`0393`) appear only as blockers. Their substitutes responses are `nominated_code_unknown` and `ok` with an empty candidate list. Both would show Escalate if opened (`relatedIds` `site-c:blocker.pen-c-03` and `site-c:blocker.pen-c-04`). The site page shows the blocker sentences ("Solution code 9999 isn't in the catalogue", "No materials recorded for solution 0393") and no path to those screens. `0943` (`pen-c-01`) is reachable because it is on the mastic shortage.
   Suggested fix: link the blocker place to `penetrationPath`, the same way shortage rows do. The approved blocker drawing does not mention the link; FR11 and the substitutes empty states still need a way in.

6. **Medium** — `src/ui/format.ts:42-43`, rendered from `src/app/sites/[id]/penetrations/[pid]/page.tsx:89`
   Substitute cards print on-hand quantities without the required "shared, not reserved" label.
   `formatMaterialSummary` emits `Fire putty pad x1 (20 on hand)`. FR3 and AC 10 require the on-hand figure to be labelled shared and not reserved. The readiness screen does that once, via `stockNotice` (`src/application/readiness.ts:5`, shown at `src/app/sites/[id]/page.tsx:71`). The substitutes screen does not repeat it, and the design's candidate card does not ask for the numbers. `tests/e2e/scenario.spec.ts:67` locks in the unlabelled figure.
   Suggested fix: drop the on-hand counts and keep the availability sentence from the design table, or show the same "On hand, shared, not reserved" notice beside those counts.

7. **Medium** — `src/ui/decisions/Dialog.tsx:132` and `src/ui/messages.ts:37`
   `validation_failed` tells the leader to "Check the highlighted fields", and the field is not highlighted.
   The textarea sets `aria-invalid` when `error` is set. No rule in `src/ui/decisions/decisions.module.css` or `src/ui/primitives.module.css` styles `[aria-invalid]` or the control border. The error sentence is danger-coloured text under the field. Client-side length and empty-reason errors use other sentences and have the same missing highlight.
   Suggested fix: give `[aria-invalid="true"]` a visible border or background in both themes, and keep the design's sentence.

8. **Medium** — `src/ui/decisions/Dialog.tsx:51-67` and `:89-95`
   Closing the dialog while "Sending…" drops the refresh and the success announcement, after the POST may already have been stored.
   `send` returns immediately when `dialogRef.current.open` is false, so `router.refresh()` and `announce` do not run. Cancel is disabled while `sending` is true. The native `<dialog>` still closes on Escape, and nothing calls `preventDefault` on `cancel`. `onClose` (`:36-42`) clears `sendingRef`. The shortage card stays on its previous badge (for example Open) until a later navigation. Opening the dialog again mints a new idempotency key (`:29`), so a second submit is a second record. Crew status does not flip to clear.
   Suggested fix: while `sendingRef` is true, cancel the `cancel` event. When the response arrives after a close, still refresh and announce.

9. **Medium** — `src/ui/decisions/api-client.ts:68-69` and `src/ui/decisions/Dialog.tsx:29`
   A failed `fetch` is reported as "Nothing was recorded", which is the `upstream_unavailable` sentence.
   Any thrown `fetch` becomes `{ ok: false, code: "upstream_unavailable" }` (`api-client.ts:68-69`). The design maps that code to "A system we depend on isn't available. Nothing was recorded. Try again." The server may have stored the action before the response was lost. Retry inside the same dialog reuses the key and can announce "Already recorded". Closing and opening calls `crypto.randomUUID()` again, so the next submit is a new write.
   Suggested fix: map a transport failure to its own sentence that does not claim the write was dropped, and keep the same idempotency key until the dialog is closed after a definite result.

10. **Medium** — `src/ui/decisions/api-client.ts:17-20` and `:28-32`, read by `src/ui/Announcer.tsx:8`
    The next full page load puts the previous decision announcement back into the polite live region.
    `announce` writes the text to `sessionStorage` under `team-leader:announce`. `getAnnouncement` returns that stored text whenever the module-level `current.id` is 0, which is every fresh document. `getServerAnnouncement` returns `""`, so after hydration the live region changes from empty to the old "Escalation recorded" (or "Already recorded" / "Proposal recorded"). A reload of `/` in the same tab can announce a decision that did not just happen.
    Suggested fix: keep the replay long enough to survive `router.refresh()` in the same document, and do not seed the live region from `sessionStorage` on a new load.

11. **Medium** — `docs/api.md:59-73` and `:79-84`
    The built responses add fields the API reference does not describe.
    `GET .../substitution-candidates` returns a `penetration` object (screen data for the substitutes page). `GET .../actions` returns `materials` and `penetrations` for name resolution. Neither is in `docs/api.md`. They do not add stock quantities, locations, supplier names, idempotency keys, or credentials. Notes stay on action records and reasons stay on proposals, which the log shows and the existing record types already carry.
    Probe (`/tmp/review-probe.json`): site A with zero actions still returns materials `MAT-COLLAR-25`, `MAT-SEALANT`, `MAT-WRAP` and all six penetrations, each `{ floor, location, nominatedCode }`. Site A readiness maps are empty. The readiness maps already documented at `docs/api.md:47-48` are only the shortage and blocker rows, so the actions maps are a wider set.
    The doc must add, on `GET .../substitution-candidates`, beside `notice`:

    ```ts
    penetration: { id, floor, location, serviceType, serviceSize, nominatedCode,
      requiredIntegrityMinutes, requiredInsulationMinutes }
    ```

    `penetration.nominatedCode` repeats the top-level `nominatedCode`. `id` repeats `penetrationId`. The screen uses the rest. Do not add substrate, orientation, or stock here.

    The doc must add, on `GET .../actions`:

    ```ts
    materials: Record<id, { name, unit }>,       // every material mapped to a nominated solution on the site
    penetrations: Record<id, { floor, location, nominatedCode }>  // every penetration on the site
    ```

    State that these maps are present even when `actions` and `proposals` are empty, and that they are not the narrower readiness maps.

12. **Medium** — `docs/ui-design.md:116` and `tests/e2e/`
    The approved design requires a Playwright case where the stock stub is down, the "can't check" banner is shown, and "Crew can go" is absent. No file under `tests/e2e/` mentions that banner or a stock failure.
    The pieces are covered apart from the browser: `tests/unit/ui-load.test.ts` maps `UpstreamError` to `{ status: "unavailable" }`, `tests/unit/ui-messages.test.ts` locks the banner sentence, and the site page renders that banner on `loaded.status === "unavailable"`. A regression that ignored the flag in the page would not fail the suite that the design names.
    Suggested fix: add the Playwright case from design section 6. Do not change the banner copy.

### Low

13. **Low** — `src/ui/messages.ts:52-57`
    A blocked site with shortages `0` and one or more blockers is worded "Blocked: 0 shortages (and N data problems). Hold the crew until stock arrives."
    The design's blocked row always leads with the shortage count and always ends with "until stock arrives". The sample has no blocker-only site (site C is 1 shortage and 2 blockers, which the pluralisation handles and the unit test locks). The zero path is still what the function returns.
    Suggested fix: when `shortages === 0`, lead with the data-problem count and do not say stock will clear the crew. That is an edge the approved sentence does not spell out.

14. **Low** — `src/ui/status.ts:71`
    `in_stock` is labelled "Materials in stock" with the same green check icon as "Crew can go".
    The design's availability table has no `in_stock` row. The other four sentences match that table, including the full stops. The page-level notice is still "Catalogue match, not verified", so the chip does not say the substitute is approved.
    Suggested fix: pick a stock sentence that is not the crew-clear icon, and add it to the design table.

15. **Low** — `src/ui/decisions/Dialog.tsx:137-138`, checks in `src/ui/decisions/WaitDialog.tsx:74-76` and `src/ui/decisions/ProposeDialog.tsx:87-91`
    The counter shows the raw length. The limit is the trimmed length.
    Input `"x" * 500` plus a trailing space displays "501 of 500 characters" and is accepted (`trim` length 500, client reject is false). Five hundred spaces display "500 of 500 characters" and the reason dialog then says "Give a reason." (`trim` length 0).
    Suggested fix: count `value.trim().length` in the "of 500" line.

## Verified OK

Safety copy. Grep of `src/ui` and `src/app` found no "compatible", "approved", "successfully", or "please". "Catalogue match, not verified" and "On hand, shared, not reserved" are the API constants (`src/application/candidates.ts:13`, `src/application/readiness.ts:5`) rendered unchanged. "This does not release the crew." is in the wait and escalate dialogs only (`WaitDialog.tsx:53`, `EscalateDialog.tsx:59`). Propose uses "A manager has to verify this catalogue match." No success string says the crew is released. "Crew can go" is only `crewStatus("clear")` (`src/ui/status.ts:18`). `readinessBanner` uses that only after the blocked, unavailable, and nothing-planned branches.

Fail closed. `loadPage` maps `UpstreamError` to `{ status: "unavailable" }` and calls `notFound()` on a 404 (`src/app/_lib/load.ts:12-15`). Site, substitutes, and actions pages render the 502 banner on that status and do not render "Crew can go". `listSites` sets `crewStatus: "unavailable"` on any per-site throw (`src/application/sites.ts:19-22`). The list chip for that value is "Can't check" with a warning icon (`src/ui/status.ts:21`). Unknown stock uses "Need X, stock unknown" when on-hand or shortfall is null (`src/ui/format.ts:12`), including site C mastic (`Need 1, stock unknown`). Blockers render only under an `h2` "Data problems", with Escalate and no Wait (`BlockerCard.tsx:32-34`). Domain crew status is blocked whenever any shortage or blocker exists (`src/domain/readiness.ts:178`).

Crew banner, against design section 3. Clear: "Crew can go", check. Blocked with shortages: "Blocked: N shortage(s). Hold the crew until stock arrives.", cross. With blockers: " (and M data problem(s))" inside that sentence. Singular and plural are covered by `tests/unit/ui-messages.test.ts` (included in the vitest run below). Nothing planned: "Nothing planned for this site", dashed circle. List chip for nothing planned is the shorter "Nothing planned". 502: the design sentence, warning icon. Icons are `aria-hidden` with visible text (`Icon.tsx:6`, `StatusChip.tsx:6-9`, `Banner.tsx:9-10`).

Shortage and blocker cards. Known shortage line is "Need X, have Y, short Z unit". State badges are Open, Waiting, Escalated. A non-current action adds "Earlier decision, shortfall has grown" (`hasEarlierDecision` in `ShortageCard.tsx:39` and `BlockerCard.tsx:30`). Affected count, expandable list, floor and location, and links to the substitutes route are in `ShortageCard.tsx:36-53`. Blocker sentences match the three design reasons (`src/ui/status.ts:38-45`).

Decision dialogs. Purchasing is the initial and re-opened value (`EscalateDialog.tsx:18` and `:24`). Note and reason use a visible "N of 500 characters" count. Empty and whitespace reasons are rejected with "Give a reason." before POST. Over-trim-500 is rejected before POST. The idempotency key is `crypto.randomUUID()` in `openDialog` and is not replaced on a failed send, so a retry in the same dialog reuses it. The primary button shows "Sending…" and is disabled while `sending` is true. `onClose` focuses the opener when it is still connected. Native `<dialog>` provides the trap and Escape. Live region is `role="status"` / `aria-live="polite"` (`Announcer.tsx:13`). Success copy is "Escalation recorded", "Wait recorded", "Proposal recorded". A 200 with `created: false` is a replay; `send` does not also announce success; `installReplayAnnouncer` (mounted from the root layout) announces "Already recorded". Every code in the design table has the design sentence (`messages.ts:36-45`). Any other code, including a body that fails the safe-code check, uses "Something went wrong. Nothing was recorded." `postDecision` never returns the server `message`.

Substitutes. The page shows floor, location, service, size, nominated code, rating, and `listed.notice` for every status. `ok` + candidates renders one card per candidate. Availability sentences for `short`, `unknown`, `no_material_mapping`, and `invalid_quantity` match the design table (`status.ts:72-77`). `stale_nomination` and `not_a_candidate` use the design sentences as dialog alerts. Empty reason does not POST (client check in `ProposeDialog.tsx:87-89`).

Actions log. `classifyActionsForList` and proposal `byNewest` sort newest first (`src/domain/lifecycle.ts:46`, `src/application/actions.ts:35`). Chips say Current, "Earlier decision, shortfall has grown", and Resolved. Proposals are a separate "Proposed substitutes" section, titled "Proposed substitute: {from} to {to}", with reason, time, and author. Empty state is "Nothing recorded for this site yet." only when both lists are empty. `actionTarget` uses the material name, or "floor, location" for `blocker.{penetrationId}`, and falls back to the material id or penetration id (`format.ts:70-86`).

Shell. Root layout sets `lang="en"` and the banner "Demo: sample data, no login" in `header` (`src/app/layout.tsx:12-16`), so pages, `loading.tsx`, `not-found.tsx`, and `error.tsx` inherit it. Next 16 passes `retry` into `error.tsx` (`node_modules/next/dist/client/components/error-boundary.js:110-114`); the button calls that `retry`, which refreshes and resets. `error.tsx` does not render `error.message` or the digest value (only `data-digest="present"|"absent"`). Each of those screens has one `h1`. Dialog titles are `h2`. Pages set `dynamic = "force-dynamic"`, and `loadPage` awaits `connection()`.

Additive fields, behaviour. `penetration` on the candidate list matches the substitutes summary and was checked for `pen-a-01` keys: `id`, `floor`, `location`, `serviceType`, `serviceSize`, `nominatedCode`, `requiredIntegrityMinutes`, `requiredInsulationMinutes`. Candidate `materials` are `{ name, unit }` only. The actions maps are present and resolve names as above. The gap is documentation (finding 11), not a missing field.

Layout tokens checked in CSS, not in a browser. Base font `1rem`, smallest text `0.875rem` (14px at a 16px root), main `max-width: 45rem` (720px), `overflow-wrap: anywhere`, and `min-width` / `min-height: 44px` on buttons, site cards, block links, the disclosure summary, and dialog controls. `prefers-color-scheme` and `prefers-reduced-motion` are set. Computed contrast for the token pairs in light and dark is at least 5.95:1 (script below). No Tailwind and no component-library dependency in `package.json`.

Departures that track the design and were not raised: "Send wait" and "Send proposal" (the design names "Send escalation" and uses the same verb-first pattern); "Give a reason."; "A manager has to verify this catalogue match."; "Loading"; "Page not found" / "That page does not exist."; "Something went wrong" / "Try again."; "Show affected penetrations"; "As of …"; "By {author}"; the action and proposal sentences; "Rating" and "Nominated solution". Escalate is also rendered for `substrate_incomplete` and `nominated_code_unknown` when a related row exists (`pen-c-01` escalates `site-c:MAT-MASTIC`; `pen-c-03` escalates its blocker). The empty-state table attaches the button to the `ok` + empty row only.

Not browser-tested. No `next dev`, `next start`, or Playwright, per the review brief. CSS measurements and focus-after-refresh were not confirmed in a running page.

## Commands

- Contrast script (inline `node -e`, luminance pairs from `src/app/globals.css`). Exit code 0. Every listed pair was AA (lowest 5.95:1, light link on surface).
- `cd /tmp/review-copy && npx vitest run --config vitest.review.config.ts tests/unit/ui-messages.test.ts tests/unit/ui-status.test.ts tests/unit/ui-format.test.ts tests/unit/ui-load.test.ts /tmp/review-probe.test.ts`. Exit code 0. 5 files, 39 tests passed. Cache dir forced to `/tmp` so Vite did not write `node_modules/.vite-temp` in the repo.
- Probe rerun after it was changed to write `/tmp/review-probe.json`. Exit code 0. 1 file, 1 test passed. Output is the site/penetration table cited above (`pen-a-01` related ids `[]`, `pen-b-10` related `site-b:MAT-SEALANT`, site A actions maps non-empty while readiness maps are empty).
- Trim-versus-counter check (inline `node -e`). Exit code 0. Trailing space: shown 501, trimmed 500, client reject false. Spaces-only reason: shown 500, trimmed 0.
