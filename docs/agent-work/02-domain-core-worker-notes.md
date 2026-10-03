# Domain core notes

## Decisions

- Required quantity is the sum of `quantityPerInstall` for a material, then `Math.ceil(Math.round(sum * 1e6) / 1e6)`.
- No stock rows means `kind: "unknown"` with null on-hand and shortfall. A row of quantity 0 is known stock, so a positive requirement is `kind: "short"`.
- On hand is the sum of every balance row for that material. Each site is computed on its own and sees the full sum. Nothing is reserved.
- A penetration whose nominated code is missing from the catalogue, or present with no solution-material rows, is a blocker and adds no requirement. Material rows for an unknown code are ignored.
- Only penetrations and actions with `siteId === input.siteId` are used. An action is attached only when its shortage id matches.
- Shortage id is `${siteId}:${materialId}`. Shortages are sorted by `materialId` using code-unit order.
- Actions are ordered by the `createdAt` string, newest first. Equal strings keep input order. Use one ISO 8601 form. Mixed offsets are not parsed into instants.
- `classifyActionsForList` matches an action to a shortage by shortage id only.
- A substrate is incomplete when its trimmed text ends with `,`. Stored `substrateDetail`, `serviceType` and `serviceSize` keep the CSV text, including surrounding spaces.
- Integrity and insulation accept an unsigned integer or decimal after trim. Insulation `-` after trim is null. A leading minus is rejected.
- `findCandidates` returns the catalogue's own `Solution` objects, in catalogue order. Callers must not mutate them.
- "Catalogue match, not verified" is not a domain field. `CandidateResult` is a status plus solutions. The screen has to use that wording.
- `loadCatalogueFromCsv()` with no path reads `data/solutions-excerpt.csv` relative to `src/adapters/catalogue-csv.ts`, not the process cwd.

## Departures

- Non-numeric insulation throws, in the same way as integrity. The brief named integrity only. A bad insulation cell must not be stored as "not claimed".
- Owning docs were not edited. This brief says not to touch `docs/`.

## Checked expectations

The real CSV produced the pinned results. No expected value was changed.

- 148 solutions.
- Incomplete codes, in file order: `0853`, `0943`, `0944`, `0946`, `0952`, `0955`.
- Null insulation: `0334`, `0335`, `0722`, `0724`, `0804`, `0811`, `0813`, `0968`.
- Solutions with at least one candidate, skipping incomplete substrates: `0334`, `0434`, `0438`, `0451`, `0452`, `0464`, `0465`, `0646`, `0707`, `0708`, `0722`, `0724`, `0733`, `0736`, `0743`, `0789`, `0791`, `0804`, `0813`, `0968`.

## Not verified

- API, database and end-to-end criteria (AC 9, 11–13, 16, 17, 23, 24, 27–32). This brief stops at the domain and the CSV adapter.
- `npm run check:ac`. These unit tests name AC 1–8, 10, 14, 15, 18–22, 25 and 26. The other numbers are not referenced here.
- No browser. There is no UI in this change.

## For the orchestrator

- Put "catalogue match, not verified" and "on hand, shared, not reserved" on the screen. The domain does not return those sentences.
- Do not pass an untrusted path to `loadCatalogueFromCsv`.
- Escalate target, note length and idempotency are not checked here. They belong at the write boundary.
- Tests were run once before the modules existed (fail: cannot resolve `@/domain`) and again after the implementation.

## Verification

Commands run in the repo on 2026-10-03.

- `npm run typecheck` — exit 0
- `npm run lint` — exit 0
- `npm run test:coverage` — exit 0. 6 files, 69 tests passed (67 new unit tests plus the existing catalogue hash test).

```text
Statements   : 100% ( 160/160 )
Branches     : 100% ( 97/97 )
Functions    : 100% ( 30/30 )
Lines        : 100% ( 133/133 )
```

`src/domain/types.ts` and `src/domain/index.ts` have no executable statements, so v8 reports them as empty. The threshold is 95% and was not changed.
