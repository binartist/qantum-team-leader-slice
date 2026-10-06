"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { ANNOUNCE, BUTTONS, CREW_STAYS, RECORDS_ONLY } from "../messages";
import styles from "../primitives.module.css";
import { shortageActionUrl } from "./api-client";
import { Dialog, TextControl, useDecisionDialog } from "./Dialog";
import { dialogFieldError, dialogFormError, escalateDestination, noteProblem } from "./form";
import dialogStyles from "./decisions.module.css";

type Destination = "purchasing" | "warehouse";

/** `prominent` makes the trigger a full-width primary button, for a screen where escalating is the main action. */
export function EscalateDialog({
  siteId,
  shortageId,
  target,
  prominent = false,
}: {
  siteId: string;
  shortageId: string;
  target: string;
  prominent?: boolean;
}) {
  const titleId = useId();
  const noteId = useId();
  const sendToId = useId();
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<Destination>("purchasing");
  const [fieldError, setFieldError] = useState("");
  const dialog = useDecisionDialog(ANNOUNCE.escalation);

  function open() {
    setNote("");
    setDestination("purchasing");
    setFieldError("");
    dialog.openDialog();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = noteProblem(note);
    if (problem) {
      setFieldError(problem);
      document.getElementById(noteId)?.focus();
      return;
    }
    setFieldError("");
    const trimmed = note.trim();
    const body = trimmed ? { escalateTo: destination, note: trimmed } : { escalateTo: destination };
    const code = await dialog.send(shortageActionUrl(siteId, shortageId, "escalate"), body);
    const field = dialogFieldError(code);
    if (field) setFieldError(field);
  }

  const formError = dialogFormError(dialog.formError);

  return (
    <>
      <Button
        type="button"
        className={prominent ? `${styles.primary} ${styles.fullWidth}` : undefined}
        aria-label={`${BUTTONS.escalate} ${target}`}
        onClick={open}
      >
        <Icon name="arrow-up" />
        {BUTTONS.escalate}
      </Button>
      <Dialog
        dialogRef={dialog.dialogRef}
        title={`Escalate: ${target}`}
        titleId={titleId}
        idempotencyKey={dialog.key}
        onClose={dialog.onClose}
        onCancel={dialog.onCancel}
      >
        <form className={dialogStyles.form} onSubmit={onSubmit}>
          <p>{CREW_STAYS}</p>
          <p>{RECORDS_ONLY}</p>
          <div className={dialogStyles.field}>
            <label className={dialogStyles.label} htmlFor={sendToId}>
              Send to
            </label>
            <select
              id={sendToId}
              className={dialogStyles.control}
              name="escalateTo"
              value={destination}
              onChange={(event) => setDestination(escalateDestination(event.target.value))}
            >
              <option value="purchasing">Purchasing</option>
              <option value="warehouse">Warehouse</option>
            </select>
          </div>
          <TextControl id={noteId} label="Note" value={note} onChange={setNote} error={fieldError} />
          {formError ? (
            <p className={dialogStyles.fieldError} role="alert">
              {formError}
            </p>
          ) : null}
          <div className={dialogStyles.actions}>
            <Button type="submit" className={styles.primary} disabled={dialog.sending}>
              {dialog.sending ? BUTTONS.sending : BUTTONS.sendEscalation}
            </Button>
            <Button type="button" onClick={dialog.requestClose} disabled={dialog.sending}>
              {BUTTONS.cancel}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
