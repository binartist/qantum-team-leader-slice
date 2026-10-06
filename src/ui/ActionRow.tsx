import { Card } from "./Card";
import { formatRecordedAt, proposalSentence } from "./format";
import { StatusChip } from "./StatusChip";
import { actionStatus, decisionMark, proposalMark, type ActionChip } from "./status";
import styles from "./primitives.module.css";

export function ActionRow({
  sentence,
  recordedAt,
  createdBy,
  note,
  status,
  href,
  decision,
  heading = "h4",
  scope = null,
}: {
  sentence: string;
  recordedAt: string;
  createdBy: string;
  note: string | null;
  status: ActionChip;
  /** The work this decision is about; null when there is nothing to open. */
  href: string | null;
  decision: "wait" | "escalate";
  heading?: "h3" | "h4";
  /** Muted line under the sentence, when the decision still covers penetrations at this site. */
  scope?: string | null;
}) {
  return (
    <Card title={sentence} heading={heading} mark={decisionMark(decision)} titleHref={href ?? undefined}>
      {scope ? <p className={styles.muted}>{scope}</p> : null}
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
  heading = "h4",
}: {
  fromCode: string;
  toCode: string;
  /** "L3, Riser 2", when the penetration is known. */
  place: string | undefined;
  /** Null when the proposal is already about the page it is shown on. */
  href: string | null;
  reason: string;
  recordedAt: string;
  createdBy: string;
  heading?: "h3" | "h4";
}) {
  return (
    <Card title={proposalSentence(fromCode, toCode, place)} heading={heading} mark={proposalMark()} titleHref={href ?? undefined}>
      <p>{reason.trim()}</p>
      <p>{formatRecordedAt(recordedAt)}</p>
      <p className={styles.muted}>{`By ${createdBy}`}</p>
    </Card>
  );
}
