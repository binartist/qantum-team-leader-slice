"use client";

import { useId, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV } from "./messages";
import { NavContent } from "./NavContent";
import { navSectionForPath } from "./nav-section";
import { applySidebar, readSidebar } from "./sidebar";
import styles from "./primitives.module.css";

const CHANGED = "team-leader:sidebar-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** Persistent menu at 1024px and wider. Hidden below that, where the drawer is the only menu. */
export function SideMenu() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribe,
    () => readSidebar(document.documentElement) === "collapsed",
    () => false,
  );
  const navId = useId();

  function toggle() {
    applySidebar(collapsed ? "expanded" : "collapsed", document.documentElement, window.localStorage);
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <aside className={styles.sideMenu}>
      <div className={styles.drawerHeader}>
        <h2 className={styles.drawerTitle} hidden={collapsed}>
          {NAV.title}
        </h2>
        <button
          type="button"
          className={styles.collapseButton}
          aria-expanded={!collapsed}
          aria-controls={navId}
          aria-label={collapsed ? NAV.expand : NAV.collapse}
          onClick={toggle}
        >
          <span className={styles.collapseIconExpanded}>
            <Icon name="chevron-left" />
          </span>
          <span className={styles.collapseIconCollapsed}>
            <Icon name="chevron-right" />
          </span>
        </button>
      </div>
      <NavContent current={navSectionForPath(pathname)} collapsed={collapsed} navId={navId} />
    </aside>
  );
}
