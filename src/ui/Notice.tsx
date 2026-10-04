import type { ReactNode } from "react";
import styles from "./primitives.module.css";

export function Notice({ children }: { children: ReactNode }) {
  return <p className={`${styles.banner} ${styles.neutral}`}>{children}</p>;
}
