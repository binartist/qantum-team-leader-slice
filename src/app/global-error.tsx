"use client";

import { AppBar } from "@/ui/AppBar";
import { Button } from "@/ui/Button";
import { BUTTONS } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";
import "./globals.css";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
      </head>
      <body>
        <AppBar />
        <main>
          <h1>Something went wrong</h1>
          <p>Try again.</p>
          <Button type="button" className={styles.primary} onClick={() => retry()}>
            {BUTTONS.tryAgain}
          </Button>
        </main>
      </body>
    </html>
  );
}
