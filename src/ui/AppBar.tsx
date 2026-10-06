import type { ReactNode } from "react";
import { BackControl } from "./BackControl";
import { NavDrawer, type NavSection } from "./NavDrawer";
import styles from "./primitives.module.css";

/**
 * The sticky nav header for an inner screen: one compact row with the back control (a chevron and the name of
 * the screen it returns to) and, on a site screen, the actions control on the right. The page title is the
 * page's own `h1` in `main`, shown in full. Top-level screens use `MenuBar` instead: the leading control is
 * either the back control or the menu, never both.
 */
export function AppBar({ backHref, backName, end }: { backHref: string; backName: string; end?: ReactNode }) {
  return (
    <header className={styles.appBar}>
      <BackControl
        className={end ? `${styles.backControl} ${styles.backControlBeside}` : styles.backControl}
        href={backHref}
        name={backName}
      />
      {end}
    </header>
  );
}

/** The sticky header for a top-level screen (the landing page, Sites, Materials): the menu control that opens the drawer. */
export function MenuBar({ current }: { current: NavSection }) {
  return (
    <header className={styles.appBar}>
      <NavDrawer current={current} />
    </header>
  );
}
