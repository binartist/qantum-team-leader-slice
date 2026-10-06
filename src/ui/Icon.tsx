import type { IconName } from "./status";
import styles from "./primitives.module.css";

export function Icon({ name }: { name: IconName | "chevron-left" | "chevron-right" | "menu" | "close" }) {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      {name === "check" ? <path d="M4 10.5 8.2 14.5 16 6" fill="none" stroke="currentColor" strokeWidth="2" /> : null}
      {name === "stop" ? (
        // A stop sign: a solid octagon with the bar cut out. Not a cross, which reads as "dismiss", and solid
        // so its corners show at chip size instead of reading as a circle with a minus.
        <path d="M6.7 1.8h6.6l4.9 4.9v6.6l-4.9 4.9H6.7l-4.9-4.9V6.7z M5.5 8.8h9v2.4h-9z" fill="currentColor" fillRule="evenodd" />
      ) : null}
      {name === "dashed-circle" ? (
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      ) : null}
      {name === "chevron-left" ? (
        <path d="M12.5 5 7 10l5.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === "menu" ? (
        <path d="M3.5 5.5h13 M3.5 10h13 M3.5 14.5h13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : null}
      {name === "close" ? (
        <path d="M5.5 5.5 14.5 14.5 M14.5 5.5 5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : null}
      {name === "chevron-right" ? (
        <path d="M7.5 5 13 10l-5.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === "clock" ? (
        <path d="M10 2.75a7.25 7.25 0 1 0 0 14.5 7.25 7.25 0 0 0 0-14.5z M10 6v4.25l2.75 1.75" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === "arrow-up" ? (
        <path d="M10 16.5V4 M5 8.75 10 3.75l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
