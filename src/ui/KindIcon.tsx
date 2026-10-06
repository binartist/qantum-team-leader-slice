import styles from "./primitives.module.css";

export type EntityKind = "site" | "material" | "solution" | "decision";

/**
 * Says what a thing is, never its state. Outline only, in the secondary text colour, and no shape the status
 * icons use (tick, stop sign, triangle, circle), so it cannot be read as "can go" or "blocked". Decorative: the
 * text beside it names the thing.
 */
export function KindIcon({ kind }: { kind: EntityKind }) {
  return (
    <svg
      className={styles.kindIcon}
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "site" ? <path d="M4 17.5V3.5h8v14 M12 8h4v9.5 M2.5 17.5h15 M6.5 7h3 M6.5 10.5h3 M6.5 14h3" /> : null}
      {kind === "material" ? <path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z M3 6.5 10 10l7-3.5 M10 10v7" /> : null}
      {kind === "solution" ? <path d="M10 2.5 16 5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5z" /> : null}
      {kind === "decision" ? <path d="M6.5 4H4.5v13.5h11V4h-2 M7 2.5h6V5.5H7z M7.5 10h5 M7.5 13h5" /> : null}
    </svg>
  );
}
