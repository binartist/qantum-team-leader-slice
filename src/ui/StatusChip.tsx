import { Icon } from "./Icon";
import type { StatusView } from "./status";
import styles from "./primitives.module.css";

export function StatusChip({ status, appearance = "chip" }: { status: StatusView; appearance?: "chip" | "label" }) {
  const shape = appearance === "label" ? styles.stateLabel : styles.chip;
  return (
    <span className={`${shape} ${styles[status.tone]}`}>
      <Icon name={status.icon} />
      <span>{status.label}</span>
    </span>
  );
}
