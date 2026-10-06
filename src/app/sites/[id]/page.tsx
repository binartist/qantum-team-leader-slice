import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { SiteReadinessView } from "@/application";
import { IdSchema } from "@/ports";
import { getCachedMaterialDetail, getCachedSite } from "../../_lib/cached";
import { Notice } from "@/ui/Notice";
import { PenetrationFilters } from "@/ui/PenetrationFilters";
import { PenetrationGroups, type PenetrationPlace } from "@/ui/PenetrationGroups";
import { fromLogPath, materialPagePath, siteFromMaterialPath, sitePath } from "@/ui/format";
import { logBack, logOrigin } from "@/ui/actions-log";
import { StockFigures } from "@/ui/StockFigures";
import { EMPTY, filterLine, NO_FILTER_MATCH, PENETRATION_FILTER } from "@/ui/messages";
import { filterCounts, matchingPenetrations, materialValues, parseShow, type ShowFilter } from "@/ui/penetration-filters";
import { filterByMaterial, rowMarks } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";
import { loadSiteFrame, SiteFrame } from "./site-frame";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };
type PageProps = RouteParams & {
  searchParams: Promise<{ show?: string | string[]; material?: string | string[]; fromMaterial?: string | string[]; fromLog?: string | string[] }>;
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
  const fromMaterial = await materialOrigin(id, query.fromMaterial);
  // A material page that opened this site wins; else the actions log; else back goes to the sites list.
  const fromLog = fromMaterial ? undefined : logOrigin(query.fromLog, [id]);
  return (
    <SiteFrame frame={frame} back={fromMaterial?.back ?? (fromLog ? logBack(fromLog) : undefined)}>
      {frame.status === "ready" && frame.readiness && frame.places ? (
        <SitePenetrations
          siteId={frame.site.id}
          readiness={frame.readiness}
          places={frame.places}
          selected={parseShow(query.show)}
          material={materialValues(query.material)}
          fromMaterial={fromMaterial?.id}
          fromLog={fromLog}
        />
      ) : null}
    </SiteFrame>
  );
}

/** A single well-formed material id this site was opened from. Anything else leaves back on the sites list. */
async function materialOrigin(
  siteId: string,
  value: string | string[] | undefined,
): Promise<{ readonly id: string; readonly back: { readonly href: string; readonly name: string } } | undefined> {
  if (typeof value !== "string" || !IdSchema.safeParse(value).success) return undefined;
  try {
    const detail = await getCachedMaterialDetail(value);
    return { id: value, back: { href: materialPagePath(value, { siteId }), name: detail.material.name } };
  } catch (error) {
    unstable_rethrow(error);
    return undefined;
  }
}

function SitePenetrations({
  siteId,
  readiness,
  places,
  selected,
  material,
  fromMaterial,
  fromLog,
}: {
  siteId: string;
  readiness: SiteReadinessView;
  places: readonly PenetrationPlace[];
  selected: readonly ShowFilter[];
  material: readonly string[];
  fromMaterial?: string;
  fromLog?: string;
}) {
  // A repeated ?material= is not one material. Joining it keeps the unknown-material note and the full list.
  const materialId = material.length === 0 ? undefined : material.length === 1 ? material[0] : material.join(",");
  const filtered = filterByMaterial(places, readiness.shortages, readiness.materials, materialId);
  const shown = matchingPenetrations(filtered.places, selected, readiness.shortages, readiness.blockers);
  const counts = filterCounts(places, readiness.shortages, readiness.blockers);
  return (
    <>
      {places.length === 0 ? null : (
        <StockFigures notice={readiness.stockNotice} stockAsOf={readiness.stockAsOf} asOf={readiness.asOf} />
      )}
      <section className={styles.penetrationSection} aria-labelledby="penetrations-heading">
        {/* The heading counts every planned penetration. The chips below count subsets of that list. */}
        <h2 id="penetrations-heading" className={styles.listTitle}>
          <span>Penetrations</span>
          <span className={styles.tabCount}>{places.length}</span>
        </h2>
        <PenetrationFilters siteId={siteId} selected={selected} counts={counts} material={material} fromMaterial={fromMaterial} fromLog={fromLog} />
        {filtered.filter ? (
          <p className={styles.filterRow}>
            <span>{filterLine(filtered.filter.materialName, shown.length, filtered.filter.total)}</span>
            <Link className={styles.plannedWorkLink} href={fromMaterial ? siteFromMaterialPath(siteId, fromMaterial) : fromLog ? fromLogPath(sitePath(siteId), fromLog) : sitePath(siteId)}>
              {PENETRATION_FILTER.showAll}
            </Link>
          </p>
        ) : null}
        {filtered.unknownMaterial ? <Notice>{PENETRATION_FILTER.unknown}</Notice> : null}
        {selected.length > 0 && shown.length === 0 ? <p>{NO_FILTER_MATCH}</p> : null}
        {selected.length === 0 && shown.length === 0 ? <p>{EMPTY.penetrations}</p> : null}
        {shown.length > 0 ? (
          <PenetrationGroups
            siteId={siteId}
            places={shown}
            marks={(penetrationId) => rowMarks(penetrationId, readiness.shortages, readiness.blockers)}
          />
        ) : null}
      </section>
    </>
  );
}
