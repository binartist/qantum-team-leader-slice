import { Icon } from "./Icon";
import type { IconName, Tone } from "./status";
import styles from "./primitives.module.css";

/** A decision's number is always shown, including 1. A problem's number is shown only when that kind repeats. */
function showMarkCount(icon: IconName, count: number): boolean {
  if (icon === "clock" || icon === "arrow-up" || icon === "swap") return count > 0;
  return count > 1;
}

/** A problem or decision on a site-list row: the icon, its count, and the full wording for assistive tech. */
export function RowMark({ label, tone, icon, count }: { label: string; tone: Tone; icon: IconName; count: number }) {
  return (
    <span className={`${styles.rowMark} ${styles[tone]}`} title={label}>
      <Icon name={icon} />
      {showMarkCount(icon, count) ? <span aria-hidden="true">{count}</span> : null}
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
