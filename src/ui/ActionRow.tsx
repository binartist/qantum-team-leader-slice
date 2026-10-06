import { Card } from "./Card";
import { formatRecordedAt, proposalSentence } from "./format";
import { StatusChip } from "./StatusChip";
import { actionStatus, decisionMark, type ActionChip } from "./status";
import styles from "./primitives.module.css";

export function ActionRow({
  sentence,
  recordedAt,
  createdBy,
  note,
  status,
  href,
  decision,
}: {
  sentence: string;
  recordedAt: string;
  createdBy: string;
  note: string | null;
  status: ActionChip;
  /** The work this decision is about; null when there is nothing to open. */
  href: string | null;
  decision: "wait" | "escalate";
}) {
  return (
    <Card title={sentence} heading="h3" mark={decisionMark(decision)} titleHref={href ?? undefined}>
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
  place,
  href,
  reason,
  recordedAt,
  createdBy,
}: {
  fromCode: string;
  toCode: string;
  /** "L3, Riser 2", when the penetration is known. */
  place: string | undefined;
  href: string;
  reason: string;
  recordedAt: string;
  createdBy: string;
}) {
  return (
    <Card title={proposalSentence(fromCode, toCode, place)} heading="h3" kind="decision" titleHref={href}>
      <p>{reason.trim()}</p>
      <p>{formatRecordedAt(recordedAt)}</p>
      <p className={styles.muted}>{`By ${createdBy}`}</p>
    </Card>
  );
}
