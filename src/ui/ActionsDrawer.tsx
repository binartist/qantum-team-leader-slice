"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { FILTERS } from "./messages";
import styles from "./primitives.module.css";

/**
 * Header control that opens the site's actions log in a panel. `initialOpen` comes from the server
 * (`?log=open`); the panel does not read the query itself. The dialog uses `showModal`, so it sits in the
 * top layer: Escape, the backdrop and focus trap are the browser's, and a transformed ancestor cannot
 * park the panel off screen.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!initialOpen) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, [initialOpen]);

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  function onClose() {
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus();
  }

  return (
    <>
      <button type="button" className={styles.actionsButton} ref={openerRef} onClick={open}>
        <span>{FILTERS.actions}</span>
        {count === null ? null : <span className={styles.tabCount}>{count}</span>}
      </button>
      <dialog ref={dialogRef} className={styles.drawer} aria-labelledby={titleId} onClose={onClose}>
        <div className={styles.drawerPanel}>
          <div className={styles.drawerHeader}>
            <h2 id={titleId} className={styles.drawerTitle}>
              {FILTERS.actions}
            </h2>
            <Button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close actions log">
              Close
            </Button>
          </div>
          <div className={styles.drawerBody}>{children}</div>
        </div>
      </dialog>
    </>
  );
}
