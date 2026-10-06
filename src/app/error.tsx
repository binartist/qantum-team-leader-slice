"use client";

import { AppBar } from "@/ui/AppBar";
import { Button } from "@/ui/Button";
import { BUTTONS } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";

export default function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const marked = hasDigest(error);
  return (
    <>
      <AppBar />
      <main data-digest={marked ? "present" : "absent"}>
        <title>Something went wrong</title>
        <h1>Something went wrong</h1>
        <p>Try again.</p>
        <Button type="button" className={styles.primary} onClick={() => retry()}>
          {BUTTONS.tryAgain}
        </Button>
      </main>
    </>
  );
}

function hasDigest(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string" && error.digest.length > 0;
}
