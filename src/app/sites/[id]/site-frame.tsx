import type { ReactNode } from "react";
import type { SiteReadinessView } from "@/application";
import type { Site } from "@/ports";
import { SiteNotFoundError } from "@/ports";
import { getCachedActions, getCachedReadiness, getCachedSite } from "../../_lib/cached";
import { loadPage } from "../../_lib/load";
import { AppBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { SiteTabs, type SiteTab } from "@/ui/SiteTabs";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { formatReference } from "@/ui/format";
import { readinessBanner } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";

export type SiteFrameData =
  | { readonly status: "unavailable" }
  | {
      readonly status: "ready";
      readonly site: Site;
      /** Null when readiness could not be checked: the banner then says so, never clear. */
      readonly readiness: SiteReadinessView | null;
      /** Null when the actions could not be read: the tab then shows no number. */
      readonly actionCount: number | null;
    };

/** Loads what every site tab shows above its content: the site, its readiness banner, and the tab counts. */
export async function loadSiteFrame(id: string): Promise<SiteFrameData> {
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return { status: "unavailable" };
  const readinessLoad = await loadPage(() => getCachedReadiness(id));
  const actionsLoad = await loadPage(() => getCachedActions(id));
  return {
    status: "ready",
    site: siteLoad.value,
    readiness: readinessLoad.status === "ready" ? readinessLoad.value : null,
    actionCount:
      actionsLoad.status === "ready" ? actionsLoad.value.actions.length + actionsLoad.value.proposals.length : null,
  };
}

/** The site's own header, then the blocked/clear banner above the tabs on every tab, so a hidden tab cannot hide a blocker. */
export function SiteFrame({ frame, current, children }: { frame: SiteFrameData; current: SiteTab; children: ReactNode }) {
  if (frame.status === "unavailable") {
    return (
      <>
        <AppBar backHref="/sites" backName="Sites" />
        <main>
          <h1>This site</h1>
          <UnavailablePanel status={readinessBanner("unavailable")} />
        </main>
      </>
    );
  }
  const { site, readiness, actionCount } = frame;
  return (
    <>
      <AppBar backHref="/sites" backName="Sites" />
      <main>
        <h1>{site.name}</h1>
        <p className={styles.muted}>{formatReference(site.reference)}</p>
        {readiness ? (
          <Banner status={readinessBanner(readiness.crewStatus)} />
        ) : (
          <UnavailablePanel status={readinessBanner("unavailable")} />
        )}
        <SiteTabs
          siteId={site.id}
          current={current}
          counts={{
            shortages: readiness ? readiness.shortages.length : null,
            dataProblems: readiness ? readiness.blockers.length : null,
            actions: actionCount,
          }}
        />
        {children}
      </main>
    </>
  );
}
