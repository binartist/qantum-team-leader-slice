"use client";

import { useId, useState } from "react";
import { ProposeDialog } from "./decisions/ProposeDialog";
import { FactLine } from "./FactLine";
import { FitTable } from "./FitTable";
import { Icon } from "./Icon";
import type { FitRow } from "./fit";
import { KindIcon } from "./KindIcon";
import type { PenetrationFact } from "./penetrations";
import styles from "./primitives.module.css";

export interface SubstituteChoice {
  readonly code: string;
  readonly facts: readonly PenetrationFact[];
  readonly rows: readonly FitRow[];
}

/**
 * One substitute at a time. The menu switches which solution is open, so the list does not stack.
 * When the menu is shown it is the title: the solution shield sits on the closed control, and the
 * heading underneath is omitted. A single candidate has no menu, so it keeps the heading.
 */
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
            Select candidate
          </label>
          <span className={styles.switchSelect}>
            <span className={styles.switchMark}>
              <KindIcon kind="solution" />
            </span>
            <select id={selectId} className={styles.switchControl} value={selected.code} onChange={(event) => setCode(event.target.value)}>
              {choices.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {`Solution ${choice.code}`}
                </option>
              ))}
            </select>
            <span className={styles.switchChevron}>
              <Icon name="chevron-right" />
            </span>
          </span>
        </div>
      ) : null}
      <article>
        {choices.length > 1 ? null : (
          <h3 className={styles.kindTitle}>
            <KindIcon kind="solution" />
            {`Solution ${selected.code}`}
          </h3>
        )}
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
