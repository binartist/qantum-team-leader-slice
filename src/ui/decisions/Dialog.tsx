"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { characterCountLabel } from "../format";
import { announce, postDecision } from "./api-client";
import { sendOutcome } from "./form";
import styles from "./decisions.module.css";

export function useDecisionDialog(success: string) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const sendingRef = useRef(false);
  const keyRef = useRef("");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
  }, [open]);

  function openDialog() {
    if (sendingRef.current) return;
    const dialog = dialogRef.current;
    const active = document.activeElement;
    const inside = Boolean(dialog && active instanceof Node && dialog.contains(active));
    if (!inside && active instanceof HTMLElement) openerRef.current = active;
    const nextKey = crypto.randomUUID();
    keyRef.current = nextKey;
    setKey(nextKey);
    setFormError("");
    setSending(false);
    setOpen(true);
  }

  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (sendingRef.current) event.preventDefault();
  }

  function onClose() {
    setOpen(false);
    if (!sendingRef.current) setSending(false);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
  }

  function requestClose() {
    if (sendingRef.current) return;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  }

  async function send(url: string, body: unknown): Promise<string> {
    if (sendingRef.current) return "";
    const requestKey = keyRef.current;
    sendingRef.current = true;
    setSending(true);
    setFormError("");
    const result = await postDecision(url, requestKey, body);
    const dialogStillOpen = keyRef.current === requestKey && Boolean(dialogRef.current?.open);
    const outcome = sendOutcome(result, dialogStillOpen);
    sendingRef.current = false;
    if (keyRef.current === requestKey) setSending(false);
    if (outcome.formError) setFormError(outcome.formError);
    if (outcome.announceSuccess) announce(success);
    if (outcome.refresh) router.refresh();
    if (outcome.close && dialogRef.current?.open) dialogRef.current.close();
    return outcome.formError;
  }

  return { dialogRef, key, sending, formError, openDialog, onCancel, onClose, requestClose, send };
}

export function Dialog({
  dialogRef,
  title,
  titleId,
  idempotencyKey,
  onClose,
  onCancel,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  titleId: string;
  idempotencyKey: string;
  onClose: () => void;
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      data-idempotency-key={idempotencyKey}
      onCancel={onCancel}
      onClose={onClose}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}

export function TextControl({
  id,
  label,
  value,
  onChange,
  error,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string;
  required?: boolean;
}) {
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.control}
        name={label.toLowerCase()}
        value={value}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        aria-describedby={`${countId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={countId} className={styles.count}>
        {characterCountLabel(value)}
      </p>
      {error ? (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
