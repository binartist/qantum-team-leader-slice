# Agent guidance for this repo (tool-neutral)

Team-leader slice for the QAntum take-home. The docs are the source of truth. Read before coding:

- `docs/slice-specification.md` (requirements and numbered acceptance criteria)
- `docs/technical-design.md` (architecture, domain rules, schema)
- `docs/test-strategy.md` (layers, AC mapping, CI gates)
- `docs/glossary.md` (business terms), `docs/catalogue-data-model.md` (CSV and its quirks)

If code and spec disagree, stop and fix the spec first, then the code.

## Skills

Project skills are declared in `skill-forge.json` and vendored by `skf sync` into `.agents/skills` (`.claude/skills` is a shim). Never hand-edit them. Change the profile and re-sync. Check drift with `skf sync --check`.

## Architecture rules

- `src/domain/` is pure: no Next.js, React, database driver, file system or adapter imports (lint enforces it).
- Upstream systems (sites, nominations, stock, solution materials, catalogue) sit behind ports in `src/ports/`; adapters in `src/adapters/`.
- Route handlers in `src/app/` stay thin: validate with Zod, call a use case, map errors to `{ code, message }`.
- This app stores only wait, escalate and proposed-substitute actions. It never writes sites, nominations, stock or the catalogue.

## Safety rules (do not weaken)

- Missing or unavailable data is never zero and never "clear". Fail closed. Negative, `NaN` or infinite numbers are bad data too: they block the crew or mark stock unknown, they never cancel a need or cover a shortage.
- Never describe a substitute as compatible or approved. It is "catalogue match, not verified". Status is always `proposed`.
- Match substitutes on raw normalised fields, never on `substrate_option` or `service_type_option`.
- Do not strip trailing commas from substrates. Incomplete substrates get no candidates.
- Do not edit `data/solutions-excerpt.csv`. A test pins its hash.
- Sample data lives only in `data/sample/` and is labelled invented.
- No secrets in code, tests, logs or output. Server credentials never reach the browser. No `NEXT_PUBLIC_` for secrets.

## Working rules

- Tests come from the acceptance criteria. Name them with the AC number (for example `AC 15`). Write the test, see it fail, then implement.
- Change only what the task needs. Match the surrounding style.
- Do not commit or push unless asked. Never commit to `main` without asking.
- Update the owning docs in the same change as behaviour changes, and log notable agent corrections in `docs/submission-checklist.md`.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run check:ac
npm run build
npm run test:e2e
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
