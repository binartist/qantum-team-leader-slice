# Agent work record

Evidence of how the domain core was built and checked. Files are numbered in the order they happened. Briefs are as dispatched, so they reference paths and commands from that moment (for example the original `CLAUDE.md`, which is now `AGENTS.md`).

| File | What it is |
| --- | --- |
| `01-domain-core-brief.md` | Self-contained brief given to the build worker (Grok, grok-4.7) |
| `02-domain-core-worker-notes.md` | The worker's own notes: decisions, departures, what it did not verify |
| `03-review-brief-*.md` | Three single-lens review briefs (spec and correctness, test quality, code quality and security), each run in a fresh read-only session |
| `reviews/findings-*.md` | The three review reports, unedited |
| `04-fix-brief.md` | Brief for the fix round, with the orchestrator's triage decisions in section 3 |
| `05-fix-worker-notes.md` | The fix worker's notes, including which new tests failed before the fix |

### API layer round

| File | What it is |
| --- | --- |
| `06-api-layer-brief.md` | Brief for the API build (ports, adapters, use cases, routes, tests). Run on `grok-4.7-build-fast` |
| `07-review-brief-api-*.md` | Three single-lens review briefs for the API layer, run in fresh read-only sessions |
| `reviews/findings-api-*.md` | The three API review reports, unedited |
| `08-api-fix-brief.md` | Fix brief with the orchestrator's triage decisions in section 3 |
| `09-api-worker-notes.md`, `10-api-fix-worker-notes.md` | The workers' notes, including the response shapes and which new tests failed before each fix |

### UI round

| File | What it is |
| --- | --- |
| `11-ui-brief.md` | Brief for the UI build (pages, components, pure modules, Playwright). Run on the default model |
| `12-review-brief-ui-*.md` | Three single-lens review briefs (spec and design, tests, quality and accessibility and security), fresh read-only sessions |
| `reviews/findings-ui-*.md` | The three UI review reports, unedited |
| `13-ui-fix-brief.md` | Fix brief with 25 triaged decisions in section 3 |
| `14-ui-worker-notes.md`, `15-ui-fix-worker-notes.md` | The workers' notes. The build worker could not launch a browser; the orchestrator ran its end-to-end specs |

What the orchestrator (Claude) did, as opposed to the workers: wrote the briefs and the decisions in them, ran every gate in its own shell, checked write scope with before and after checksums, ran mutation checks of its own, triaged the review findings (accepting most, rejecting a path jail and a shortage-id re-encoding), and updated the docs.

Cost, domain core: build $0.67, three reviews $2.97, fixes $0.78. API layer: build $2.82 (fast model, 54 turns, 20.5 min), three reviews $4.83 (default model, 35 min), fixes $3.47 (fast model, 61 turns, 16.5 min). UI: build $3.29 (default model, 116 turns, 49 min), three reviews $4.10 (default model, 25 min), fixes $3.24 (default model, 108 turns, 42 min). Total worker spend $26.17. Corrections and rejections are logged in `docs/submission-checklist.md`.
