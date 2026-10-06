"use client";

import Link from "next/link";
import { Drawer } from "./Drawer";
import { Icon } from "./Icon";
import { MATERIALS_PATH } from "./format";
import { NAV } from "./messages";
import styles from "./primitives.module.css";

export type NavSection = "sites" | "materials";

const ITEMS: readonly { section: NavSection; href: string; label: string }[] = [
  { section: "sites", href: "/sites", label: NAV.sites },
  { section: "materials", href: MATERIALS_PATH, label: NAV.materials },
];

/** The menu control for a top-level screen and the left drawer it opens (AC 37). */
export function NavDrawer({ current }: { current: NavSection }) {
  return (
    <Drawer
      side="left"
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
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.navFooter}>
        <Link className={styles.navItem} href="/">
          {NAV.about}
        </Link>
      </div>
    </Drawer>
  );
}
