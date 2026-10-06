import type { SiteActions } from "@/application";
import { ActionRow, ProposalRow } from "@/ui/ActionRow";
import { actionLink, actionSentence, actionTarget, penetrationPath } from "@/ui/format";
import { EMPTY } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";

/** Recorded waits, escalations and proposed substitutes for one site, newest first. */
export function ActionsLog({ siteId, listed }: { siteId: string; listed: SiteActions }) {
  const empty = listed.actions.length === 0 && listed.proposals.length === 0;
  return (
    <>
      {empty ? <p>{EMPTY.actions}</p> : null}
      {listed.actions.length > 0 ? (
        <section>
          <h3>Recorded actions</h3>
          <ul className={styles.list}>
            {listed.actions.map((action) => {
              const target = actionTarget(siteId, action.shortageId, listed.materials, listed.penetrations);
              return (
                <li key={action.id}>
                  <ActionRow
                    sentence={actionSentence(action.kind, action.escalateTo, target)}
                    recordedAt={action.createdAt}
                    createdBy={action.createdBy}
                    note={action.note}
                    status={action.status}
                    href={actionLink(siteId, action.shortageId, action.status)}
                    decision={action.kind}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {listed.proposals.length > 0 ? (
        <section>
          <h3>Proposed substitutes</h3>
          <ul className={styles.list}>
            {listed.proposals.map((proposal) => (
              <li key={proposal.id}>
                <ProposalRow
                  fromCode={proposal.fromInternalCode}
                  toCode={proposal.toInternalCode}
                  place={placeOf(listed, proposal.penetrationId)}
                  href={penetrationPath(siteId, proposal.penetrationId)}
                  reason={proposal.reason}
                  recordedAt={proposal.createdAt}
                  createdBy={proposal.createdBy}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function placeOf(listed: SiteActions, penetrationId: string): string | undefined {
  const place = listed.penetrations[penetrationId];
  return place ? `${place.floor}, ${place.location}` : undefined;
}
