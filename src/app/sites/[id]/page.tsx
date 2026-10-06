import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { SiteReadinessView } from "@/application";
import { getCachedSite } from "../../_lib/cached";
import { Banner } from "@/ui/Banner";
import { Notice } from "@/ui/Notice";
import { PenetrationFilters } from "@/ui/PenetrationFilters";
import { PenetrationGroups, type PenetrationPlace } from "@/ui/PenetrationGroups";
import { sitePath, stockFiguresLine, stockIsStale } from "@/ui/format";
import { EMPTY, filterLine, NO_FILTER_MATCH, PENETRATION_FILTER, STOCK_STALE } from "@/ui/messages";
import { filterCounts, logIsOpen, matchingPenetrations, materialValues, parseShow, type ShowFilter } from "@/ui/penetration-filters";
import { filterByMaterial, listFactChips } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";
import { loadSiteFrame, SiteFrame } from "./site-frame";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };
type PageProps = RouteParams & {
  searchParams: Promise<{ show?: string | string[]; material?: string | string[]; log?: string | string[] }>;
};

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { id } = await params;
  try {
    const site = await getCachedSite(id);
    return { title: site?.name ?? "Site" };
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Site" };
  }
}

export default async function SitePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const frame = await loadSiteFrame(id);
  return (
    <SiteFrame frame={frame} logOpen={logIsOpen(query.log)}>
      {frame.status === "ready" && frame.readiness && frame.places ? (
        <SitePenetrations
          siteId={frame.site.id}
          readiness={frame.readiness}
          places={frame.places}
          selected={parseShow(query.show)}
          material={materialValues(query.material)}
        />
      ) : null}
    </SiteFrame>
  );
}

function SitePenetrations({
  siteId,
  readiness,
  places,
  selected,
  material,
}: {
  siteId: string;
  readiness: SiteReadinessView;
  places: readonly PenetrationPlace[];
  selected: readonly ShowFilter[];
  material: readonly string[];
}) {
  // A repeated ?material= is not one material. Joining it keeps the unknown-material note and the full list.
  const materialId = material.length === 0 ? undefined : material.length === 1 ? material[0] : material.join(",");
  const filtered = filterByMaterial(places, readiness.shortages, readiness.materials, materialId);
  const shown = matchingPenetrations(filtered.places, selected, readiness.shortages, readiness.blockers);
  const counts = filterCounts(places, readiness.shortages, readiness.blockers);
  return (
    <>
      {places.length === 0 ? null : (
        <>
          <Notice>{readiness.stockNotice}</Notice>
          <p>{stockFiguresLine(readiness.stockAsOf, readiness.asOf)}</p>
          {stockIsStale(readiness.stockAsOf, readiness.asOf) ? (
            <Banner status={{ label: STOCK_STALE, tone: "warning", icon: "warning" }} />
          ) : null}
        </>
      )}
      <PenetrationFilters siteId={siteId} selected={selected} counts={counts} material={material} />
      {filtered.filter ? (
        <p className={styles.filterRow}>
          <span>{filterLine(filtered.filter.materialName, shown.length, filtered.filter.total)}</span>
          <Link className={styles.plannedWorkLink} href={sitePath(siteId)}>
            {PENETRATION_FILTER.showAll}
          </Link>
        </p>
      ) : null}
      {filtered.unknownMaterial ? <Notice>{PENETRATION_FILTER.unknown}</Notice> : null}
      {selected.length > 0 && shown.length === 0 ? <p>{NO_FILTER_MATCH}</p> : null}
      {selected.length === 0 && shown.length === 0 ? <p>{EMPTY.penetrations}</p> : null}
      {shown.length > 0 ? (
        <section className={styles.groups} aria-label="Penetrations">
          <PenetrationGroups
            siteId={siteId}
            places={shown}
            chips={(penetrationId) => listFactChips(penetrationId, readiness.shortages, readiness.blockers)}
          />
        </section>
      ) : null}
    </>
  );
}
