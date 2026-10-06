import Link from "next/link";
import type { SiteActionsSection } from "@/application";
import { MenuBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { Icon } from "@/ui/Icon";
import { KindIcon } from "@/ui/KindIcon";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { fromLogPath, siteAnchor, sitePath } from "@/ui/format";
import { ACTIONS_LOG, NAV } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";
import { getCachedAllActions } from "../_lib/cached";
import { loadPage } from "../_lib/load";
import { ActionsLog } from "./actions-log";

export const dynamic = "force-dynamic";
export const metadata = { title: NAV.actions };

/** Every site's recorded actions (AC 43). A site that cannot be read says so and keeps its place. */
export default async function ActionsPage() {
  const loaded = await loadPage(() => getCachedAllActions());
  return (
    <>
      <MenuBar current="actions" />
      <main>
        <h1>{NAV.actions}</h1>
        {loaded.status === "unavailable" ? (
          <UnavailablePanel status={{ label: ACTIONS_LOG.unavailable, tone: "warning", icon: "warning" }} />
        ) : loaded.value.sites.length === 0 ? (
          <p>{ACTIONS_LOG.empty}</p>
        ) : (
          loaded.value.sites.map((site) => <SiteSection key={site.siteId} site={site} />)
        )}
      </main>
    </>
  );
}

function SiteSection({ site }: { site: SiteActionsSection }) {
  const anchor = siteAnchor(site.siteId);
  const headingId = `${anchor}-heading`;
  const heading = (
    // Sticks under the header while its entries scroll, so a long section still says which site it is.
    <h2 id={headingId} className={styles.stickyHeading}>
      <Link className={styles.headingLink} href={fromLogPath(sitePath(site.siteId), site.siteId)}>
        <span className={styles.kindTitle}>
          <KindIcon kind="site" />
          <span>{site.siteName}</span>
        </span>
        <Icon name="chevron-right" />
      </Link>
    </h2>
  );
  if (site.status === "unavailable") {
    return (
      <section id={anchor} className={styles.section} aria-labelledby={headingId}>
        {heading}
        <Banner status={{ label: ACTIONS_LOG.siteUnavailable, tone: "warning", icon: "warning" }} />
      </section>
    );
  }
  return (
    <section id={anchor} className={styles.section} aria-labelledby={headingId}>
      {heading}
      <ActionsLog siteId={site.siteId} listed={site.listed} />
    </section>
  );
}
