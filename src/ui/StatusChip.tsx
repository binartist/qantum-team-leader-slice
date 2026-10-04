import { Icon } from "./Icon";
import type { StatusView } from "./status";
import styles from "./primitives.module.css";

export function StatusChip({ status }: { status: StatusView }) {
  return (
    <span className={`${styles.chip} ${styles[status.tone]}`}>
      <Icon name={status.icon} />
      <span>{status.label}</span>
    </span>
  );
}
