import Link from "next/link";
import { actionsPath, dataProblemsPath, sitePath } from "./format";
import { TABS } from "./messages";
import styles from "./primitives.module.css";

export type SiteTab = "shortages" | "data-problems" | "actions";

/** A null count is unknown (its source was unavailable) and shows no number, never zero. */
export interface SiteTabCounts {
  readonly shortages: number | null;
  readonly dataProblems: number | null;
  readonly actions: number | null;
}

export function SiteTabs({ siteId, current, counts }: { siteId: string; current: SiteTab; counts: SiteTabCounts }) {
  const tabs: { id: SiteTab; label: string; href: string; count: number | null }[] = [
    { id: "shortages", label: TABS.shortages, href: sitePath(siteId), count: counts.shortages },
    { id: "data-problems", label: TABS.dataProblems, href: dataProblemsPath(siteId), count: counts.dataProblems },
    { id: "actions", label: TABS.actions, href: actionsPath(siteId), count: counts.actions },
  ];
  return (
    <nav className={styles.tabBar} aria-label={TABS.label}>
      <ul className={styles.tabs}>
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link className={styles.tab} href={tab.href} aria-current={tab.id === current ? "page" : undefined}>
              <span>{tab.label}</span>
              {tab.count === null ? null : <span className={styles.tabCount}>{tab.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
