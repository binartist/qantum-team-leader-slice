import { Card } from "./Card";
import { formatRecordedAt, proposalSentence } from "./format";
import { StatusChip } from "./StatusChip";
import { actionStatus, type ActionChip } from "./status";
import styles from "./primitives.module.css";

export function ActionRow({
  sentence,
  recordedAt,
  createdBy,
  note,
  status,
}: {
  sentence: string;
  recordedAt: string;
  createdBy: string;
  note: string | null;
  status: ActionChip;
}) {
  return (
    <Card title={sentence} heading="h3">
      <p>{formatRecordedAt(recordedAt)}</p>
      <p className={styles.muted}>{`By ${createdBy}`}</p>
      {note ? <p>{note}</p> : null}
      <StatusChip status={actionStatus(status)} />
    </Card>
  );
}

export function ProposalRow({
  fromCode,
  toCode,
  reason,
  recordedAt,
  createdBy,
}: {
  fromCode: string;
  toCode: string;
  reason: string;
  recordedAt: string;
  createdBy: string;
}) {
  return (
    <Card title={proposalSentence(fromCode, toCode)} heading="h3">
      <p>{reason.trim()}</p>
      <p>{formatRecordedAt(recordedAt)}</p>
      <p className={styles.muted}>{`By ${createdBy}`}</p>
    </Card>
  );
}
