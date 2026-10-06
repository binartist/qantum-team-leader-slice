import Link from "next/link";
import { FILTERS } from "./messages";
import { showFilterHref, SHOW_FILTERS, type ShowFilter } from "./penetration-filters";
import styles from "./primitives.module.css";

const LABELS: Record<ShowFilter, string> = {
  shortages: FILTERS.shortages,
  "data-problems": FILTERS.dataProblems,
  acted: FILTERS.acted,
};

/** Toggle links over the penetration list. A count is how many penetrations match that chip. */
export function PenetrationFilters({
  siteId,
  selected,
  counts,
  material = [],
}: {
  siteId: string;
  selected: readonly ShowFilter[];
  counts: Readonly<Record<ShowFilter, number>>;
  material?: readonly string[];
}) {
  return (
    <nav className={styles.filterDock} aria-label={FILTERS.label}>
      <ul className={styles.filterBar}>
        {SHOW_FILTERS.map((filter) => {
          const on = selected.includes(filter);
          return (
            <li key={filter}>
              <Link
                className={styles.filterChip}
                href={showFilterHref(siteId, selected, filter, material)}
                aria-current={on ? "true" : undefined}
              >
                <span>{LABELS[filter]}</span>
                <span className={styles.tabCount}>{counts[filter]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
