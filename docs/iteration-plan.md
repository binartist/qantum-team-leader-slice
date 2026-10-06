# Iteration plan

A short sequence of iterations, each useful on its own. Iteration 1 is the slice specified in `slice-specification.md`. Later iterations are directions with reasons, not commitments. Terms are in `glossary.md`.

## 1. The need

Before a crew leaves for a site, the team leader must know that the materials for the planned work are in stock, and must act on any shortage: wait, escalate, or use a different solution. Their crew planning depends on the answer.

Four things have to be true for that to work in production: the plan is known, the materials per solution are known, stock is known, and a decision reaches the right people. The first three come from other systems. The fourth does not exist today.

## 2. Why this first slice

| Option considered | Verdict |
| --- | --- |
| Read-only stock check ("what do I need, is it in stock") | Useful but no action. The leader still phones someone. |
| **Stock check plus recorded decision (wait, escalate, propose substitute)** | **Chosen.** It completes the loop the brief describes and creates the one thing that does not exist yet, a recorded decision. |
| Automatic substitution | Rejected. The catalogue cannot prove compliance, and the brief says a field match is not proof. |
| Crew scheduling | Rejected. It belongs to existing operations. The slice only reports blocked or clear. |
| Mobile, offline-first | Rejected for now. Leaders check before leaving, usually with signal, and the install path is already on mobile. |

The slice reads from upstream systems and owns only the decisions. That keeps it small, testable on its own, and easy to attach to the real systems later.

## 3. Sequence

| # | Iteration | Main value | Depends on |
| --- | --- | --- | --- |
| 1 | Readiness and decisions (this slice) | Leader sees shortages and records a decision. Crew status is reported. | Stubs for sites, nominations, stock, materials |
| 2 | Real upstream data | Numbers are trustworthy. Auth and roles exist. | Access to real APIs and a login method |
| 3 | Decisions reach people | Escalations are received, acknowledged, and closed. | Iteration 1 data. Channel for purchasing and warehouse |
| 4 | Substitution approval | A proposal becomes a controlled, approved variation. | A reviewer role and an update path to the nomination |
| 5 | Smarter planning | Partial dispatch and stock allocation across sites. | Reliable stock and a reservation model |
| 6 | Field use | Works on site with poor signal, and in the mobile app. | Iterations 2 and 3 |

### Iteration 1: readiness and decisions

- **Scope:** per `slice-specification.md`. Sample data for upstream systems, real catalogue, Supabase for actions.
- **Value:** closes the leader's loop and proves the decision data model.
- **Exit criteria:** acceptance criteria 1 to 46 pass in CI. Deployed at a public URL. Demonstration scenario runs from a clean browser.
- **Leaves untested:** real upstream latency and data quality, real users, real approval.

### Iteration 2: real upstream data

- **Scope:** replace each stub adapter with the real client behind the same port. Add login through the existing QAntum identity. Add row-level security by site membership. Replace the sample materials mapping with the real source, or extend the catalogue with required products and quantities.
- **Value:** the leader can rely on the numbers, and only the right people can act.
- **Open uncertainty:** whether required products and quantities exist anywhere today. The brief says the catalogue includes products, but the excerpt has none. If they do not exist, this iteration starts with capturing them.
- **Also here:** report the catalogue data findings back to the owner (`catalogue-data-model.md`), and decide whether the app becomes a module of the existing web app.
- **Exit:** a real site's readiness matches what the stock system and specification show, checked against a manager's own figures.

### Iteration 3: decisions reach people

- **Scope:** purchasing and warehouse see escalations, acknowledge them, and mark them resolved. The leader sees the status. Notification by email or the existing channel.
- **Value:** an escalation stops being a note nobody reads. The leader knows who is dealing with it and by when.
- **Open uncertainty:** who receives escalations today, and in what tool.
- **Exit:** an escalated shortage is acknowledged by a real recipient in a trial, and the leader sees that.

### Iteration 4: substitution approval

- **Scope:** reviewers see proposals with the evidence they need (supplier assessment, test scope, installation constraints), approve or reject with a reason, and the web app updates the nomination. The result appears to the leader, and a crew can be released.
- **Value:** substitution becomes a legitimate way to unblock work, and the golden thread records who approved what and why.
- **Open uncertainty:** whether an approval workflow exists. The brief shows managers reviewing install progress and variations, not a pre-site approval queue. Compliance review rules and who is qualified to approve need the business.
- **Exit:** an approved substitute updates the nomination, clears the shortage, and appears in the audit trail. A rejected one tells the leader why.

### Iteration 5: smarter planning

- **Scope:** partial dispatch (send the crew to penetrations that are not affected), stock allocation or reservation across sites, and delivery dates so "wait" has an expected date.
- **Value:** removes the two known limits of iteration 1: the all-or-nothing site block, and shared stock that can over-promise.
- **Depends on:** a reservation model owned by inventory, and delivery data.
- **Exit:** two sites competing for the same stock are told the truth, and a partly ready site can be worked.

### Iteration 6: field use

- **Scope:** offline reads, queued writes using the existing idempotency keys, and a Flutter surface sharing the same API.
- **Value:** works at a site with weak signal, and fits where operatives already work.
- **Depends on:** stable contracts from iterations 2 and 3, and the mobile sync pattern.
- **Exit:** a leader records a decision offline and it syncs without duplicates.

## 4. What stays where

| Concern | Stays in | Why |
| --- | --- | --- |
| Install, pins, photos | Mobile app | Out of the leader's path |
| Sites, penetrations, nominations | Existing web app | The slice only reads |
| Stock | Inventory system | The slice only reads |
| Crew schedule | Existing operations | The slice reports blocked or clear |
| Decisions (wait, escalate, proposal) | This app | The one thing that is new |

## 5. Biggest uncertainties and how each iteration reduces them

| Uncertainty | First addressed | How |
| --- | --- | --- |
| Do materials and quantities exist per solution? | 2 | Check the source of truth, or capture it |
| Who receives escalations and in what form? | 3 | Trial with real recipients |
| Does an approval workflow exist? | 4 | Confirm with the business before building |
| Is shared stock misleading in practice? | 1 (labelled), 5 (fixed) | Watch for over-commit in a trial |
| Do leaders want site-wide or per-penetration blocking? | 1 (site-wide), 5 | Observe how they plan crews |

## 6. Notes

- Order is driven by dependency and risk. Iterations 3 and 4 could swap if the business needs approvals sooner than escalation tracking.
- Each iteration keeps the ports and contracts from iteration 1, so earlier work is extended rather than replaced.
- Iteration 1 is deliberately honest about its limits: stub upstream data, shared unreserved stock, site-wide blocking, no login.
