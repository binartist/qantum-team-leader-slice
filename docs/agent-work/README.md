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

What the orchestrator (Claude) did, as opposed to the workers: wrote the briefs and the decisions in them, ran every gate in its own shell, checked write scope with before and after checksums, ran mutation checks of its own, triaged the review findings (accepting most, rejecting a path jail and a shortage-id re-encoding), and updated the docs.

Cost: build $0.67, three reviews $2.97, fixes $0.78. Corrections and rejections are logged in `docs/submission-checklist.md`.
