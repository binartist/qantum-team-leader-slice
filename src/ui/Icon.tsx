import type { IconName } from "./status";
import styles from "./primitives.module.css";

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      {name === "check" ? <path d="M4 10.5 8.2 14.5 16 6" fill="none" stroke="currentColor" strokeWidth="2" /> : null}
      {name === "cross" ? <path d="M5 5 15 15 M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="2" /> : null}
      {name === "dashed-circle" ? (
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      ) : null}
      {name === "warning" ? (
        <>
          <path d="M10 3 18 17 H2 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 8 V12" stroke="currentColor" strokeWidth="2" />
          <circle cx="10" cy="14.6" r="0.9" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}
