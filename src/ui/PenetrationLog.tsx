import { ActionRow, ProposalRow } from "./ActionRow";
import { materialDecisionScope, type PenetrationLogEntry } from "./penetration-log";
import { PENETRATION_LOG } from "./messages";
import styles from "./primitives.module.css";

/** This penetration's decisions and proposals, newest first, in one list. */
export function PenetrationLog({
  entries,
  shortages,
}: {
  entries: readonly PenetrationLogEntry[];
  shortages: readonly { readonly materialId: string; readonly penetrationIds: readonly string[] }[];
}) {
  if (entries.length === 0) return <p>{PENETRATION_LOG.empty}</p>;
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`}>
          {entry.kind === "action" ? (
            <ActionRow
              heading="h3"
              sentence={entry.sentence}
              recordedAt={entry.createdAt}
              createdBy={entry.createdBy}
              note={entry.note}
              status={entry.status}
              href={entry.href}
              decision={entry.decision}
              scope={materialDecisionScope(entry.materialId, shortages)}
            />
          ) : (
            <ProposalRow
              heading="h3"
              fromCode={entry.fromCode}
              toCode={entry.toCode}
              place={entry.place}
              href={null}
              reason={entry.reason}
              recordedAt={entry.createdAt}
              createdBy={entry.createdBy}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
