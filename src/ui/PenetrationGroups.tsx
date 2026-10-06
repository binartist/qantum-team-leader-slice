import Link from "next/link";
import { penetrationGroups, penetrationLine, penetrationPath, type PenetrationRow } from "./format";
import { Icon } from "./Icon";
import { KindIcon } from "./KindIcon";
import { SUBSTITUTES } from "./messages";
import { StatusChip } from "./StatusChip";
import type { StatusView } from "./status";
import styles from "./primitives.module.css";

export interface PenetrationPlace extends PenetrationRow {
  readonly id: string;
}

/**
 * Penetrations grouped under their nominated solution, each row linking to its substitutes. Optional facts
 * are per-penetration lines (a data problem, a short material); there is never a "ready" mark.
 */
export function PenetrationGroups({
  siteId,
  places,
  facts,
}: {
  siteId: string;
  places: readonly PenetrationPlace[];
  facts?: (penetrationId: string) => readonly StatusView[];
}) {
  return (
    <>
      {penetrationGroups(places).map((group) => (
        <div key={group.heading}>
          <h3 className={`${styles.groupHeading} ${styles.kindTitle}`}>
            <KindIcon kind="solution" />
            {group.heading}
          </h3>
          <ul className={styles.list}>
            {group.places.map((place) => (
              <li key={place.id}>
                <Link className={styles.penetrationLink} href={penetrationPath(siteId, place.id)}>
                  <span className={styles.penetrationLines}>
                    <span>{penetrationLine(place)}</span>
                    {(facts?.(place.id) ?? []).map((fact) => (
                      <span key={fact.label} className={styles.penetrationFact}>
                        <StatusChip status={fact} appearance="label" />
                      </span>
                    ))}
                  </span>
                  <span className={styles.substitutesCue}>
                    <span>{SUBSTITUTES}</span>
                    <Icon name="chevron-right" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
