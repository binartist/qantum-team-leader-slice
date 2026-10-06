"use client";

import type { ReactNode } from "react";
import { Drawer } from "./Drawer";
import { FILTERS } from "./messages";
import styles from "./primitives.module.css";

/**
 * Header control that opens the site's actions log in a right-hand panel. `initialOpen` comes from the
 * server (`?log=open`); the panel does not read the query itself.
 */
export function ActionsDrawer({
  count,
  initialOpen,
  children,
}: {
  /** Null when the log could not be read: the button shows no number, never zero. */
  count: number | null;
  initialOpen: boolean;
  children: ReactNode;
}) {
  return (
    <Drawer
      side="right"
      title={FILTERS.actions}
      closeLabel="Close actions log"
      initialOpen={initialOpen}
      trigger={{
        className: styles.actionsButton,
        content: (
          <>
            <span>{FILTERS.actions}</span>
            {count === null ? null : <span className={styles.tabCount}>{count}</span>}
          </>
        ),
      }}
    >
      <div className={styles.drawerBody}>{children}</div>
    </Drawer>
  );
}
