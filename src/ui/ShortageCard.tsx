import Link from "next/link";
import { EscalateDialog } from "./decisions/EscalateDialog";
import { WaitDialog } from "./decisions/WaitDialog";
import { affectedCount, formatNeed, penetrationDisclosureLabel, penetrationGroups, penetrationLine, penetrationPath, type PenetrationRow } from "./format";
import { Icon } from "./Icon";
import { Card } from "./Card";
import { OPEN_PENETRATION, SUBSTITUTES } from "./messages";
import { StatusChip } from "./StatusChip";
import { earlierDecision, shortageState, type ShortageChip } from "./status";
import styles from "./primitives.module.css";

export function ShortageCard({
  siteId,
  shortageId,
  materialName,
  requiredQty,
  onHandQty,
  shortfallQty,
  unit,
  state,
  earlier,
  places,
}: {
  siteId: string;
  shortageId: string;
  materialName: string;
  requiredQty: number;
  onHandQty: number | null;
  shortfallQty: number | null;
  unit: string;
  state: ShortageChip;
  earlier: boolean;
  places: readonly (PenetrationRow & { readonly id: string })[];
}) {
  return (
    <Card title={materialName}>
      <p>{formatNeed(requiredQty, onHandQty, shortfallQty, unit)}</p>
      <p>{affectedCount(places.length)}</p>
      <div className={styles.row}>
        <StatusChip status={shortageState(state)} appearance="label" />
        {earlier ? <StatusChip status={earlierDecision()} appearance="label" /> : null}
      </div>
      {places.length > 0 ? (
        <details className={styles.disclosure}>
          <summary className={styles.summary}>
            <span className={styles.disclosureChevron}>
              <Icon name="chevron-right" />
            </span>
            {penetrationDisclosureLabel(places.length)}
          </summary>
          <div className={styles.disclosureBody}>
            <p>{OPEN_PENETRATION}</p>
            {penetrationGroups(places).map((group) => (
              <div key={group.heading}>
                <h3 className={styles.groupHeading}>{group.heading}</h3>
                <ul className={styles.list}>
                  {group.places.map((place) => {
                    return (
                      <li key={place.id}>
                        <Link className={styles.penetrationLink} href={penetrationPath(siteId, place.id)}>
                          <span className={styles.penetrationLines}>{penetrationLine(place)}</span>
                          <span className={styles.substitutesCue}>
                            <span>{SUBSTITUTES}</span>
                            <Icon name="chevron-right" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <div className={styles.row}>
        <WaitDialog siteId={siteId} shortageId={shortageId} target={materialName} />
        <EscalateDialog siteId={siteId} shortageId={shortageId} target={materialName} />
      </div>
    </Card>
  );
}
