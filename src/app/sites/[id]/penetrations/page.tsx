import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { SiteNotFoundError } from "@/ports";
import { getCachedSite, getCachedSiteData } from "../../../_lib/cached";
import { loadPage } from "../../../_lib/load";
import { AppBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { Notice } from "@/ui/Notice";
import { PenetrationGroups, type PenetrationPlace } from "@/ui/PenetrationGroups";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { penetrationsPath, plannedWorkLine, sitePath } from "@/ui/format";
import { EMPTY, filterLine, PENETRATION_FILTER, readinessBanner } from "@/ui/messages";
import { filterByMaterial, penetrationFacts } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ material?: string | string[] }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { id } = await params;
  try {
    const site = await getCachedSite(id);
    return { title: site ? `${site.name} penetrations` : "Penetrations" };
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Penetrations" };
  }
}

/** Every planned penetration on the site, pushed in from the planned-work line on the site screen. */
export default async function PenetrationsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { material } = await searchParams;
  // A repeated ?material= is not one material: treat it as unknown, so the full list shows with its note.
  const materialId = Array.isArray(material) ? material.join(",") : material;
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") {
    return (
      <>
        <AppBar backHref="/sites" backName="Sites" />
        <main>
          <h1>Penetrations</h1>
          <UnavailablePanel status={readinessBanner("unavailable")} />
        </main>
      </>
    );
  }
  const site = siteLoad.value;
  const dataLoad = await loadPage(() => getCachedSiteData(id));
  if (dataLoad.status === "unavailable") {
    return (
      <>
        <AppBar backHref={sitePath(site.id)} backName={site.name} />
        <main>
          <h1>Penetrations</h1>
          <UnavailablePanel status={readinessBanner("unavailable")} />
        </main>
      </>
    );
  }

  const { readiness, sitePenetrations } = dataLoad.value;
  const all: PenetrationPlace[] = Object.entries(sitePenetrations).map(([penetrationId, place]) => ({ id: penetrationId, ...place }));
  const planned = plannedWorkLine(all.map((place) => place.nominatedCode));
  const { places, filter, unknownMaterial } = filterByMaterial(all, readiness.shortages, readiness.materials, materialId);
  return (
    <>
      <AppBar backHref={sitePath(site.id)} backName={site.name} />
      <main>
        <h1>Penetrations</h1>
        {planned ? <p className={styles.muted}>{planned}</p> : null}
        <Banner status={readinessBanner(readiness.crewStatus)} />
        {filter ? (
          <p className={styles.filterRow}>
            <span>{filterLine(filter.materialName, filter.shown, filter.total)}</span>
            <Link className={styles.plannedWorkLink} href={penetrationsPath(site.id)}>
              {PENETRATION_FILTER.showAll}
            </Link>
          </p>
        ) : null}
        {unknownMaterial ? <Notice>{PENETRATION_FILTER.unknown}</Notice> : null}
        {places.length === 0 ? (
          <p>{EMPTY.penetrations}</p>
        ) : (
          <section className={styles.groups}>
            <PenetrationGroups
              siteId={site.id}
              places={places}
              facts={(penetrationId) =>
                penetrationFacts(penetrationId, readiness.shortages, readiness.blockers, readiness.materials)
              }
            />
          </section>
        )}
      </main>
    </>
  );
}
