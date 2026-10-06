"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./primitives.module.css";

/**
 * A header control and the side panel it opens. The panel is a dialog opened with `showModal`, so it sits
 * in the top layer: Escape and the focus trap are the browser's, and a transformed ancestor cannot park it
 * off screen. A tap on the backdrop closes it, but only when the press also started there, so a drag out
 * of the panel does not. Choosing a link inside closes it as it navigates. Closing returns focus to the
 * control.
 */
export function Drawer({
  side,
  title,
  closeLabel,
  trigger,
  initialOpen = false,
  children,
}: {
  side: "left" | "right";
  title: string;
  closeLabel: string;
  trigger: { readonly className: string | undefined; readonly label?: string; readonly content: ReactNode; readonly popup?: boolean };
  initialOpen?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    if (initialOpen) open();
  }, [initialOpen, open]);

  return (
    <>
      <button
        type="button"
        className={trigger.className}
        ref={openerRef}
        onClick={open}
        aria-label={trigger.label}
        aria-haspopup={trigger.popup ? "dialog" : undefined}
      >
        {trigger.content}
      </button>
      <dialog
        ref={dialogRef}
        className={`${styles.drawer} ${side === "left" ? styles.drawerLeft : styles.drawerRight}`}
        aria-labelledby={titleId}
        onClose={() => {
          const opener = openerRef.current;
          if (opener?.isConnected) opener.focus();
        }}
        onPointerDown={(event) => {
          // The backdrop is the dialog itself, outside the panel that fills it.
          pressedOutside.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          const onBackdrop = pressedOutside.current && event.target === event.currentTarget;
          pressedOutside.current = false;
          if (onBackdrop || (event.target instanceof Element && event.target.closest("a"))) close();
        }}
      >
        <div className={styles.drawerPanel}>
          <div className={styles.drawerHeader}>
            <h2 id={titleId} className={styles.drawerTitle}>
              {title}
            </h2>
            <button type="button" className={styles.drawerClose} onClick={close} aria-label={closeLabel}>
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
