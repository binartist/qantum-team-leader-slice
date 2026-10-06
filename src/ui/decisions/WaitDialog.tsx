"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { ANNOUNCE, BUTTONS, CREW_STAYS, RECORDS_ONLY } from "../messages";
import styles from "../primitives.module.css";
import { shortageActionUrl } from "./api-client";
import { Dialog, TextControl, useDecisionDialog } from "./Dialog";
import { dialogFieldError, dialogFormError, noteProblem } from "./form";
import dialogStyles from "./decisions.module.css";

export function WaitDialog({ siteId, shortageId, target }: { siteId: string; shortageId: string; target: string }) {
  const titleId = useId();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState("");
  const dialog = useDecisionDialog(ANNOUNCE.wait);

  function open() {
    setNote("");
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
    const code = await dialog.send(shortageActionUrl(siteId, shortageId, "wait"), trimmed ? { note: trimmed } : {});
    const field = dialogFieldError(code);
    if (field) setFieldError(field);
  }

  const formError = dialogFormError(dialog.formError);

  return (
    <>
      <Button type="button" aria-label={`${BUTTONS.wait} ${target}`} onClick={open}>
        <Icon name="clock" />
        {BUTTONS.wait}
      </Button>
      <Dialog
        dialogRef={dialog.dialogRef}
        title={`Wait: ${target}`}
        titleId={titleId}
        idempotencyKey={dialog.key}
        onClose={dialog.onClose}
        onCancel={dialog.onCancel}
      >
        <form className={dialogStyles.form} onSubmit={onSubmit}>
          <p>{CREW_STAYS}</p>
          <p>{RECORDS_ONLY}</p>
          <TextControl id={noteId} label="Note" value={note} onChange={setNote} error={fieldError} />
          {formError ? (
            <p className={dialogStyles.fieldError} role="alert">
              {formError}
            </p>
          ) : null}
          <div className={dialogStyles.actions}>
            <Button type="submit" className={styles.primary} disabled={dialog.sending}>
              {dialog.sending ? BUTTONS.sending : BUTTONS.sendWait}
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
