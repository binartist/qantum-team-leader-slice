import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { StatusView } from "./status";
import styles from "./primitives.module.css";

export function Banner({ status, children }: { status: StatusView; children?: ReactNode }) {
  return (
    <div className={`${styles.banner} ${styles[status.tone]}`}>
      <Icon name={status.icon} />
      <p>{children ?? status.label}</p>
    </div>
  );
}
