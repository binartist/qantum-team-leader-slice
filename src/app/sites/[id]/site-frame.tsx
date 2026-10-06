import type { ReactNode } from "react";
import type { SiteReadinessView } from "@/application";
import type { Site } from "@/ports";
import { SiteNotFoundError } from "@/ports";
import { getCachedSite, getCachedSiteData } from "../../_lib/cached";
import { loadPage } from "../../_lib/load";
import { AppBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { formatReference, plannedWorkLine } from "@/ui/format";
import { readinessBanner } from "@/ui/messages";
import type { PenetrationPlace } from "@/ui/PenetrationGroups";
import styles from "@/ui/primitives.module.css";
import { SiteActionsButton } from "./site-actions";

export type SiteFrameData =
  | { readonly status: "unavailable" }
  | {
      readonly status: "ready";
      readonly site: Site;
      /** Null when readiness could not be checked: the banner then says so, never clear. */
      readonly readiness: SiteReadinessView | null;
      /** "12 penetrations, 5 solutions": what the check covered. Null when unknown or nothing is planned. */
      readonly plannedWork: string | null;
      /** Every planned penetration. Null when the site's work could not be read. */
      readonly places: readonly PenetrationPlace[] | null;
    };

/** Loads what the site screen shows above its list: the site, its readiness banner, and the planned work. */
export async function loadSiteFrame(id: string): Promise<SiteFrameData> {
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return { status: "unavailable" };
  const siteDataLoad = await loadPage(() => getCachedSiteData(id));
  return {
    status: "ready",
    site: siteLoad.value,
    readiness: siteDataLoad.status === "ready" ? siteDataLoad.value.readiness : null,
    plannedWork:
      siteDataLoad.status === "ready"
        ? plannedWorkLine(Object.values(siteDataLoad.value.sitePenetrations).map((place) => place.nominatedCode))
        : null,
    places:
      siteDataLoad.status === "ready"
        ? Object.entries(siteDataLoad.value.sitePenetrations).map(([penetrationId, place]) => ({ id: penetrationId, ...place }))
        : null,
  };
}

/** The site's header, then the list. A blocked site's rows already say why, so it has no summary banner. */
export function SiteFrame({
  frame,
  logOpen,
  back = { href: "/sites", name: "Sites" },
  children,
}: {
  frame: SiteFrameData;
  logOpen: boolean;
  /** Where back goes. The sites list, unless this screen was opened from a material page. */
  back?: { readonly href: string; readonly name: string };
  children: ReactNode;
}) {
  if (frame.status === "unavailable") {
    return (
      <>
        <AppBar backHref={back.href} backName={back.name} />
        <main>
          <h1>This site</h1>
          <UnavailablePanel status={readinessBanner("unavailable")} />
        </main>
      </>
    );
  }
  const { site, readiness, plannedWork } = frame;
  return (
    <>
      <AppBar backHref={back.href} backName={back.name} end={<SiteActionsButton siteId={site.id} initialOpen={logOpen} />} />
      <main>
        <h1>{site.name}</h1>
        <p className={`${styles.muted} ${styles.plannedWork}`}>
          <span>{formatReference(site.reference)}</span>
          {plannedWork ? <span>{plannedWork}</span> : null}
        </p>
        {readiness && readiness.crewStatus !== "blocked" ? (
          <Banner status={readinessBanner(readiness.crewStatus)} />
        ) : null}
        {readiness ? null : <UnavailablePanel status={readinessBanner("unavailable")} />}
        {children}
      </main>
    </>
  );
}
