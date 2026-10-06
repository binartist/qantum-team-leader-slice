import { Icon } from "./Icon";
import type { IconName, Tone } from "./status";
import styles from "./primitives.module.css";

/** A problem or decision on a site-list row: the icon, a count when it repeats, and the full wording for assistive tech. */
export function RowMark({ label, tone, icon, count }: { label: string; tone: Tone; icon: IconName; count: number }) {
  return (
    <span className={`${styles.rowMark} ${styles[tone]}`} title={label}>
      <Icon name={icon} />
      {count > 1 ? <span aria-hidden="true">{count}</span> : null}
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
