import Link from "next/link";
import { EscalateDialog } from "./decisions/EscalateDialog";
import { WaitDialog } from "./decisions/WaitDialog";
import { affectedCount, formatNeed, penetrationPath } from "./format";
import { Card } from "./Card";
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
  places: readonly { readonly id: string; readonly label: string }[];
}) {
  return (
    <Card title={materialName}>
      <p>{formatNeed(requiredQty, onHandQty, shortfallQty, unit)}</p>
      <p>{affectedCount(places.length)}</p>
      <div className={styles.row}>
        <StatusChip status={shortageState(state)} />
        {earlier ? <StatusChip status={earlierDecision()} /> : null}
      </div>
      {places.length > 0 ? (
        <details>
          <summary className={styles.summary}>Show affected penetrations</summary>
          <ul className={styles.list}>
            {places.map((place) => (
              <li key={place.id}>
                <Link className={styles.blockLink} href={penetrationPath(siteId, place.id)}>
                  {place.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className={styles.row}>
        <WaitDialog siteId={siteId} shortageId={shortageId} target={materialName} />
        <EscalateDialog siteId={siteId} shortageId={shortageId} target={materialName} />
      </div>
    </Card>
  );
}
