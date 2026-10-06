"use client";

import { useId, useState } from "react";
import { ProposeDialog } from "./decisions/ProposeDialog";
import { FactLine } from "./FactLine";
import { FitTable } from "./FitTable";
import type { FitRow } from "./fit";
import { KindIcon } from "./KindIcon";
import type { PenetrationFact } from "./penetrations";
import styles from "./primitives.module.css";

export interface SubstituteChoice {
  readonly code: string;
  readonly facts: readonly PenetrationFact[];
  readonly rows: readonly FitRow[];
}

/** One substitute at a time. The menu switches which solution is open, so the list does not stack. */
export function SubstituteSwitcher({
  siteId,
  penetrationId,
  fromCode,
  choices,
}: {
  siteId: string;
  penetrationId: string;
  fromCode: string;
  choices: readonly SubstituteChoice[];
}) {
  const selectId = useId();
  const [code, setCode] = useState(choices[0]?.code ?? "");
  const selected = choices.find((choice) => choice.code === code) ?? choices[0];
  if (!selected) return null;

  return (
    <>
      {choices.length > 1 ? (
        <div className={styles.switchField}>
          <label className={styles.switchLabel} htmlFor={selectId}>
            Solution
          </label>
          <select id={selectId} className={styles.switchControl} value={selected.code} onChange={(event) => setCode(event.target.value)}>
            {choices.map((choice) => (
              <option key={choice.code} value={choice.code}>
                {choice.code}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <article>
        <h3 className={styles.kindTitle}>
          <KindIcon kind="solution" />
          {`Solution ${selected.code}`}
        </h3>
        {selected.facts.length === 0 ? null : (
          <ul className={styles.list}>
            {selected.facts.map((fact) => (
              <li key={fact.label}>
                <FactLine fact={fact} />
              </li>
            ))}
          </ul>
        )}
        <FitTable code={selected.code} rows={selected.rows} />
        <ProposeDialog siteId={siteId} penetrationId={penetrationId} fromCode={fromCode} toCode={selected.code} />
      </article>
    </>
  );
}
