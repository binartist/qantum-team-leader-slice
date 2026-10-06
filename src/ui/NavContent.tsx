"use client";

import Link from "next/link";
import { KindIcon, type EntityKind } from "./KindIcon";
import { ABOUT_PATH, ACTIONS_PATH, MATERIALS_PATH } from "./format";
import { NAV } from "./messages";
import type { NavSection } from "./nav-section";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./primitives.module.css";

const ITEMS: readonly { section: NavSection; href: string; label: string; kind: EntityKind }[] = [
  { section: "sites", href: "/sites", label: NAV.sites, kind: "site" },
  { section: "materials", href: MATERIALS_PATH, label: NAV.materials, kind: "material" },
  { section: "actions", href: ACTIONS_PATH, label: NAV.actions, kind: "decision" },
];

/**
 * The entries shared by the drawer and the wide side menu. The title row stays in each shell: the drawer
 * pairs it with Close, the side menu with Collapse. `collapsed` hides Theme; CSS clips the labels on the
 * icon rail before paint so the links keep their names.
 */
export function NavContent({
  current,
  collapsed,
  navId,
}: {
  current: NavSection | "none";
  collapsed: boolean;
  navId: string;
}) {
  return (
    <>
      <nav id={navId} aria-label={NAV.label} className={styles.navPanel}>
        <ul className={styles.navItems}>
          {ITEMS.map((item) => (
            <li key={item.section}>
              <Link
                className={styles.navItem}
                href={item.href}
                aria-current={item.section === current ? "page" : undefined}
                title={item.label}
              >
                <KindIcon kind={item.kind} />
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* About the demo is not part of the work, so it sits apart from the main entries. */}
        <ul className={`${styles.navItems} ${styles.navSecondary}`}>
          <li>
            <Link className={styles.navItem} href={ABOUT_PATH} aria-current={current === "about" ? "page" : undefined} title={NAV.about}>
              <KindIcon kind="about" />
              <span className={styles.navLabel}>{NAV.about}</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className={styles.navFooter} hidden={collapsed}>
        <ThemeSwitch />
      </div>
    </>
  );
}
