import Link from "next/link";
import { DecisionChip } from "./DecisionChip";
import { penetrationLine, penetrationPath, penetrationsByPlace, type PenetrationRow } from "./format";
import { Icon } from "./Icon";
import { KindIcon } from "./KindIcon";
import { SUBSTITUTES } from "./messages";
import type { DecisionChip as DecisionChipData } from "./penetrations";
import type { StatusView } from "./status";
import { StatusChip } from "./StatusChip";
import styles from "./primitives.module.css";

export interface PenetrationPlace extends PenetrationRow {
  readonly id: string;
}

/**
 * One row per penetration, in place order. Chips only name the kind of problem. The penetration page
 * carries the full reason and any link to a stock page. There is never a "ready" mark.
 */
export function PenetrationGroups({
  siteId,
  places,
  chips,
  decisions,
}: {
  siteId: string;
  places: readonly PenetrationPlace[];
  chips?: (penetrationId: string) => readonly StatusView[];
  decisions?: (penetrationId: string) => readonly DecisionChipData[];
}) {
  return (
    <ul className={styles.list}>
      {penetrationsByPlace(places).map((place) => {
        const rowDecisions = decisions?.(place.id) ?? [];
        return (
          <li key={place.id} className={styles.penetrationRow}>
            <Link className={styles.penetrationLink} href={penetrationPath(siteId, place.id)}>
              <span className={styles.penetrationLines}>
                <span className={styles.kindTitle}>
                  <KindIcon kind="penetration" />
                  <span>{penetrationLine(place)}</span>
                </span>
                <span className={styles.factChips}>
                  {(chips?.(place.id) ?? []).map((chip) => (
                    <StatusChip key={chip.label} status={chip} />
                  ))}
                </span>
              </span>
              <span className={styles.substitutesCue}>
                <span>{SUBSTITUTES}</span>
                <Icon name="chevron-right" />
              </span>
            </Link>
            {rowDecisions.length > 0 ? (
              <div className={styles.decisionChips}>
                {rowDecisions.map((decision) => (
                  <DecisionChip key={decision.state} penetrationId={place.id} place={penetrationLine(place)} decision={decision} />
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
