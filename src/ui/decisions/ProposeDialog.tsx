"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "../Button";
import { ANNOUNCE, BUTTONS, MANAGER_CHECK } from "../messages";
import styles from "../primitives.module.css";
import { substitutionUrl } from "./api-client";
import { Dialog, TextControl, useDecisionDialog } from "./Dialog";
import { dialogFieldError, dialogFormError, reasonProblem } from "./form";
import dialogStyles from "./decisions.module.css";

export function ProposeDialog({
  siteId,
  penetrationId,
  fromCode,
  toCode,
}: {
  siteId: string;
  penetrationId: string;
  fromCode: string;
  toCode: string;
}) {
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const dialog = useDecisionDialog(ANNOUNCE.proposal);

  function open() {
    setReason("");
    setFieldError("");
    dialog.openDialog();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = reasonProblem(reason);
    if (problem) {
      setFieldError(problem);
      document.getElementById(reasonId)?.focus();
      return;
    }
    setFieldError("");
    const code = await dialog.send(substitutionUrl(siteId, penetrationId), {
      fromInternalCode: fromCode,
      toInternalCode: toCode,
      reason: reason.trim(),
    });
    const field = dialogFieldError(code);
    if (field) setFieldError(field);
  }

  const formError = dialogFormError(dialog.formError);

  return (
    <>
      <Button type="button" aria-label={`${BUTTONS.propose} ${toCode}`} onClick={open}>
        {BUTTONS.propose}
      </Button>
      <Dialog
        dialogRef={dialog.dialogRef}
        title={`Propose ${toCode}`}
        titleId={titleId}
        idempotencyKey={dialog.key}
        onClose={dialog.onClose}
        onCancel={dialog.onCancel}
      >
        <form className={dialogStyles.form} onSubmit={onSubmit}>
          <p>{MANAGER_CHECK}</p>
          <TextControl id={reasonId} label="Reason" value={reason} onChange={setReason} error={fieldError} required />
          {formError ? (
            <p className={dialogStyles.fieldError} role="alert">
              {formError}
            </p>
          ) : null}
          <div className={dialogStyles.actions}>
            <Button type="submit" className={styles.primary} disabled={dialog.sending}>
              {dialog.sending ? BUTTONS.sending : BUTTONS.sendProposal}
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
