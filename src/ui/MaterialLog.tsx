import { ActionRow } from "./ActionRow";
import type { MaterialLogEntry } from "./material-log";
import styles from "./primitives.module.css";

/** This material's waits and escalations, newest first. Entries do not link: the Stock tab names each site. */
export function MaterialLog({ entries }: { entries: readonly MaterialLogEntry[] }) {
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <li key={`${entry.siteId}-${entry.id}`}>
          <ActionRow
            heading="h3"
            sentence={entry.sentence}
            recordedAt={entry.createdAt}
            createdBy={entry.createdBy}
            note={entry.note}
            status={entry.status}
            href={null}
            decision={entry.decision}
            scope={entry.at}
          />
        </li>
      ))}
    </ul>
  );
}
