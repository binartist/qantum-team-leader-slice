"use client";

import { Button } from "./Button";
import { BUTTONS } from "./messages";
import styles from "./primitives.module.css";

export function ReloadButton() {
  return (
    <Button type="button" className={styles.primary} onClick={() => window.location.reload()}>
      {BUTTONS.tryAgain}
    </Button>
  );
}
