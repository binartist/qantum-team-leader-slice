import { Card } from "./Card";
import { EscalateDialog } from "./decisions/EscalateDialog";
import { penetrationPath } from "./format";
import { StatusChip } from "./StatusChip";
import { blockerReason, earlierDecision, shortageState, type BlockerCode, type FitFieldCode, type ShortageChip } from "./status";
import styles from "./primitives.module.css";

export function BlockerCard({
  siteId,
  blockerId,
  penetrationId,
  place,
  reason,
  code,
  mismatches,
  state,
  earlier,
}: {
  siteId: string;
  blockerId: string;
  penetrationId: string;
  place: string;
  reason: BlockerCode;
  code: string;
  mismatches?: readonly FitFieldCode[];
  state: ShortageChip;
  earlier: boolean;
}) {
  const detail = blockerReason(reason, code, mismatches);
  return (
    <Card title={place} heading="h3" titleHref={penetrationPath(siteId, penetrationId)} kind="data-problem">
      <p>{detail.label}</p>
      <div className={styles.row}>
        <StatusChip status={shortageState(state)} appearance="label" />
        {earlier ? <StatusChip status={earlierDecision()} appearance="label" /> : null}
      </div>
      <div className={styles.row}>
        <EscalateDialog siteId={siteId} shortageId={blockerId} target={place} />
      </div>
    </Card>
  );
}
