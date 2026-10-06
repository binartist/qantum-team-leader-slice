import type { CSSProperties } from "react";
import { decisionChipName, type DecisionChip as DecisionChipData } from "./penetrations";
import { formatRecordedAt } from "./format";
import { StatusChip } from "./StatusChip";
import styles from "./primitives.module.css";

/** A decision on a list row. The button opens a native popover; there is no script. */
export function DecisionChip({
  penetrationId,
  place,
  decision,
}: {
  penetrationId: string;
  place: string;
  decision: DecisionChipData;
}) {
  const id = `decision-${penetrationId}-${decision.state}`;
  const name = decisionChipName(decision.chip.label, place);
  // IdSchema allows ".", which is not a CSS ident, so the anchor name cannot copy the id raw.
  // The property sits on the wrapper so the trigger and the popover both inherit it.
  const anchor = { "--decision-anchor": `--${id.replaceAll(".", "_")}` } as CSSProperties;
  return (
    <span className={styles.decisionAnchor} style={anchor}>
      <button type="button" popoverTarget={id} className={styles.decisionChip} aria-label={name}>
        <StatusChip status={decision.chip} />
      </button>
      <div id={id} popover="auto" role="dialog" aria-label={name} className={styles.decisionPopover}>
        <p className={styles.decisionSentence}>{decision.latest.sentence}</p>
        <p>{formatRecordedAt(decision.latest.recordedAt)}</p>
        <p className={styles.muted}>{`By ${decision.latest.createdBy}`}</p>
        {decision.latest.note ? <p>{decision.latest.note}</p> : null}
      </div>
    </span>
  );
}
