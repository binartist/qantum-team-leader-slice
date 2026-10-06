import Link from "next/link";
import { EscalateDialog } from "./decisions/EscalateDialog";
import { WaitDialog } from "./decisions/WaitDialog";
import { affectedCount, formatNeed, penetrationsPath } from "./format";
import { Icon } from "./Icon";
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
  materialId,
  affected,
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
  materialId: string;
  /** How many planned penetrations use this material. The link opens them on the Penetrations page. */
  affected: number;
}) {
  return (
    <Card title={materialName} kind="material">
      <p>{formatNeed(requiredQty, onHandQty, shortfallQty, unit)}</p>
      <Link className={styles.affectedLink} href={penetrationsPath(siteId, materialId)}>
        <span>{affectedCount(affected)}</span>
        <Icon name="chevron-right" />
      </Link>
      <div className={styles.row}>
        <StatusChip status={shortageState(state)} appearance="label" />
        {earlier ? <StatusChip status={earlierDecision()} appearance="label" /> : null}
      </div>
      <div className={styles.row}>
        <WaitDialog siteId={siteId} shortageId={shortageId} target={materialName} />
        <EscalateDialog siteId={siteId} shortageId={shortageId} target={materialName} />
      </div>
    </Card>
  );
}
