import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./primitives.module.css";

/**
 * The sticky nav header for an inner screen: one compact row with the back control (a chevron and the name of
 * the screen it returns to) and, on a site screen, the actions control on the right. The page title is the
 * page's own `h1` in `main`, shown in full. Top-level screens have no header, so they do not render this.
 */
export function AppBar({ backHref, backName, end }: { backHref: string; backName: string; end?: ReactNode }) {
  return (
    <header className={styles.appBar}>
      <Link className={styles.backControl} href={backHref} aria-label={`Back to ${backName}`}>
        <Icon name="chevron-left" />
        <span className={styles.backLabel}>{backName}</span>
      </Link>
      {end}
    </header>
  );
}
