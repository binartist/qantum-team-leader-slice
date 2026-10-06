"use client";

import { useId, useSyncExternalStore } from "react";
import { THEME } from "./messages";
import { THEME_CHOICES, applyTheme, readTheme, type ThemeChoice } from "./theme";
import styles from "./primitives.module.css";

const CHANGED = "team-leader:theme-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** System, Light or Dark, as one radio group. The server renders System; the browser then shows the stamped choice. */
export function ThemeSwitch() {
  // The drawer and the side menu each render one; a shared name would make all six radios one group.
  const name = useId();
  const current = useSyncExternalStore(
    subscribe,
    () => readTheme(document.documentElement),
    (): ThemeChoice => "system",
  );

  function choose(choice: ThemeChoice) {
    applyTheme(choice, document.documentElement, window.localStorage);
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <fieldset className={styles.themeSwitch}>
      <legend className={styles.themeLegend}>{THEME.legend}</legend>
      <div className={styles.themeOptions}>
        {THEME_CHOICES.map((choice) => (
          <label key={choice} className={styles.themeOption}>
            <input type="radio" name={name} value={choice} checked={current === choice} onChange={() => choose(choice)} />
            <span>{THEME[choice]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
