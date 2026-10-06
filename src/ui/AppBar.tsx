import { BackControl } from "./BackControl";
import { NavDrawer, type NavSection } from "./NavDrawer";
import styles from "./primitives.module.css";

/**
 * The sticky nav header for an inner screen: one compact row with the back control (a chevron and the name of
 * the screen it returns to). The page title is the page's own `h1` in `main`, shown in full. Top-level screens
 * use `MenuBar` instead: the leading control is either the back control or the menu, never both.
 */
export function AppBar({ backHref, backName }: { backHref: string; backName: string }) {
  return (
    <header className={styles.appBar}>
      <BackControl className={styles.backControl} href={backHref} name={backName} />
    </header>
  );
}

/** The sticky header for a top-level screen (the landing page, Sites, Materials, Actions log): the menu control that opens the drawer. At 1024px and wider the side menu replaces it, so this bar is hidden and must not keep a sticky offset. */
export function MenuBar({ current }: { current: NavSection }) {
  return (
    <header className={`${styles.appBar} ${styles.menuBar}`} data-menu-bar="">
      <NavDrawer current={current} />
    </header>
  );
}
