import Link from "next/link";
import { penetrationLine, penetrationPath, penetrationsByPlace, type PenetrationRow } from "./format";
import { Icon } from "./Icon";
import { KindIcon } from "./KindIcon";
import { SUBSTITUTES } from "./messages";
import type { RowMark as RowMarkData } from "./penetrations";
import { RowMark } from "./RowMark";
import styles from "./primitives.module.css";

export interface PenetrationPlace extends PenetrationRow {
  readonly id: string;
}

/**
 * One row per penetration, in place order. Marks only name the kind of problem, or that a decision was
 * recorded. The penetration page carries the full reason. There is never a "ready" mark.
 */
export function PenetrationGroups({
  siteId,
  places,
  marks,
}: {
  siteId: string;
  places: readonly PenetrationPlace[];
  marks?: (penetrationId: string) => readonly RowMarkData[];
}) {
  return (
    <ul className={styles.list}>
      {penetrationsByPlace(places).map((place) => (
        <li key={place.id}>
          <Link className={styles.penetrationLink} href={penetrationPath(siteId, place.id)}>
            <span className={styles.penetrationLines}>
              <span className={styles.kindTitle}>
                <KindIcon kind="penetration" />
                <span>{penetrationLine(place)}</span>
              </span>
              <span className={styles.rowMarks}>
                {(marks?.(place.id) ?? []).map((mark, index) => (
                  <RowMark key={`${mark.label}-${index}`} label={mark.label} tone={mark.tone} icon={mark.icon} count={mark.count} />
                ))}
              </span>
            </span>
            <span className={styles.substitutesCue}>
              <span>{SUBSTITUTES}</span>
              <Icon name="chevron-right" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
