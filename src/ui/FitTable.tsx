import type { FitRow } from "./fit";
import { StatusChip } from "./StatusChip";
import { doesNotFit } from "./status";
import styles from "./primitives.module.css";

/** Penetration and nominated solution side by side; a field that does not fit is marked with an icon and text (AC 36). */
export function FitTable({ code, rows }: { code: string; rows: readonly FitRow[] }) {
  return (
    <table className={styles.fitTable}>
      <thead>
        <tr>
          <th scope="col">
            <span className={styles.srOnly}>Field</span>
          </th>
          <th scope="col">Penetration</th>
          <th scope="col">{`Solution ${code}`}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.penetration}</td>
            <td>
              {row.fits ? (
                row.solution
              ) : (
                <StatusChip status={doesNotFit(row.solution)} appearance="label" />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
