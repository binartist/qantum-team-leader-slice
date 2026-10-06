"use client";

import Link from "next/link";
import { Drawer } from "./Drawer";
import { Icon } from "./Icon";
import { KindIcon, type EntityKind } from "./KindIcon";
import { ACTIONS_PATH, MATERIALS_PATH } from "./format";
import { NAV } from "./messages";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./primitives.module.css";

export type NavSection = "sites" | "materials" | "actions" | "about";

const ITEMS: readonly { section: NavSection; href: string; label: string; kind: EntityKind }[] = [
  { section: "sites", href: "/sites", label: NAV.sites, kind: "site" },
  { section: "materials", href: MATERIALS_PATH, label: NAV.materials, kind: "material" },
  { section: "actions", href: ACTIONS_PATH, label: NAV.actions, kind: "decision" },
];

/** The menu control for a top-level screen and the left drawer it opens (AC 37). */
export function NavDrawer({ current }: { current: NavSection }) {
  return (
    <Drawer
      title={NAV.title}
      closeLabel={NAV.close}
      trigger={{
        className: styles.menuButton,
        label: NAV.open,
        content: <Icon name="menu" />,
        popup: true,
      }}
    >
      <nav aria-label={NAV.label} className={styles.navPanel}>
        <ul className={styles.navItems}>
          {ITEMS.map((item) => (
            <li key={item.section}>
              <Link
                className={styles.navItem}
                href={item.href}
                aria-current={item.section === current ? "page" : undefined}
              >
                <KindIcon kind={item.kind} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* About the demo is not part of the work, so it sits apart from the main entries. */}
        <ul className={`${styles.navItems} ${styles.navSecondary}`}>
          <li>
            <Link className={styles.navItem} href="/" aria-current={current === "about" ? "page" : undefined}>
              <KindIcon kind="about" />
              <span>{NAV.about}</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className={styles.navFooter}>
        <ThemeSwitch />
      </div>
    </Drawer>
  );
}
