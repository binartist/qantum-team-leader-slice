# Decisions so far

First slice is the team-leader action experience. Other systems are documented and stubbed, not built.

## Boundary

The leader app stores actions only: wait, escalate, and a proposed substitute.

It does not write sites, nominations, stock, or the solution catalogue. It reads those from upstream systems.

## Upstream reads

- `GET /sites` lists sites the leader can open.
- `GET /sites/{id}/nominations` returns planned penetrations and the nominated `internal_code`.
- `GET /stock` returns inventory balances, read-only.

In the exercise these are stubbed with sample JSON. The solution catalogue is loaded from `data/solutions-excerpt.csv` so codes can be resolved locally. Production owns that catalogue; nominations only reference `internal_code`.

## Actions this app owns

- `POST /sites/{id}/shortages/{shortageId}/wait`
- `POST /sites/{id}/shortages/{shortageId}/escalate`
- `POST /sites/{id}/penetrations/{penetrationId}/substitutions`
- `GET /sites/{id}/actions`

A substitute selects another existing catalogue solution. It does not invent one. Status stays `proposed`.

## Downstream, not built

- Approval of a substitute happens in the existing web app. Only then does that app update the nomination row. The brief does not show this approval queue already existing.
- Crew planning consumes ready vs blocked.
- Escalate is received by purchasing or the warehouse.
- Install, pins, and photos stay on the mobile app.

## Still a gap inside the slice

The CSV has no materials or quantities. Shortage math needs sample data that maps a solution to materials and a quantity per install.

## Left for later

Real auth, a real inventory system, nomination writes, crew scheduling, and compliant-substitution approval.
