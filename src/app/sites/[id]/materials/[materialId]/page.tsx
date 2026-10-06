import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { SiteReadinessView } from "@/application";
import { IdSchema, SiteNotFoundError } from "@/ports";
import { getCachedSite, getCachedSiteData } from "../../../../_lib/cached";
import { loadPage } from "../../../../_lib/load";
import { AppBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { Notice } from "@/ui/Notice";
import { StatusChip } from "@/ui/StatusChip";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { WaitDialog } from "@/ui/decisions/WaitDialog";
import { Icon } from "@/ui/Icon";
import {
  decisionScope,
  groupPlaces,
  penetrationLine,
  plannedAt,
  siteMaterialPath,
  siteNeedLine,
  sitePath,
  stockFiguresLine,
  stockIsStale,
} from "@/ui/format";
import { NOT_A_SHORTAGE, SHOW_ON_SITE_LIST, STOCK_STALE, readinessBanner } from "@/ui/messages";
import { logIsOpen } from "@/ui/penetration-filters";
import { earlierDecision, hasEarlierDecision, shortageState } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { SiteActionsButton } from "../../site-actions";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; materialId: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ log?: string | string[] }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { id, materialId } = await params;
  if (!IdSchema.safeParse(materialId).success) return { title: "Material" };
  try {
    const data = await getCachedSiteData(id);
    const shortage = data.readiness.shortages.find((item) => item.materialId === materialId);
    const name = shortage ? (data.readiness.materials[materialId]?.name ?? materialId) : "Material";
    return { title: name };
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Material" };
  }
}

/** One material's stock at this site: the planned amount, and the penetrations that need it. */
export default async function MaterialPage({ params, searchParams }: PageProps) {
  const { id, materialId } = await params;
  const { log } = await searchParams;
  if (!IdSchema.safeParse(materialId).success) notFound();

  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return unavailable(materialId, "/sites", "Sites");

  const site = siteLoad.value;
  const actions = <SiteActionsButton siteId={site.id} initialOpen={logIsOpen(log)} />;
  const dataLoad = await loadPage(() => getCachedSiteData(id));
  if (dataLoad.status === "unavailable") return unavailable(materialId, sitePath(id), site.name, actions);

  const { readiness } = dataLoad.value;
  const shortage = readiness.shortages.find((item) => item.materialId === materialId);
  const name = readiness.materials[materialId]?.name ?? materialId;

  return (
    <>
      <AppBar backHref={sitePath(site.id)} backName={site.name} end={actions} />
      <main>
        <h1>{shortage ? name : materialId}</h1>
        {shortage ? (
          <MaterialStock siteId={site.id} siteName={site.name} readiness={readiness} shortage={shortage} materialName={name} />
        ) : (
          <Notice>{NOT_A_SHORTAGE}</Notice>
        )}
      </main>
    </>
  );
}

function MaterialStock({
  siteId,
  siteName,
  readiness,
  shortage,
  materialName,
}: {
  siteId: string;
  siteName: string;
  readiness: SiteReadinessView;
  shortage: SiteReadinessView["shortages"][number];
  materialName: string;
}) {
  const unit = readiness.materials[shortage.materialId]?.unit ?? "";
  const count = shortage.penetrationIds.length;
  // Text, not links: the penetration page links here, so a link back would loop (user decision). Identical
  // places collapse into one line; the way to act on one of them is up through the site list.
  const places = groupPlaces(
    shortage.penetrationIds.map((penetrationId) => {
      const place = readiness.penetrations[penetrationId];
      return place ? penetrationLine(place) : penetrationId;
    }),
  );
  return (
    <>
      <Notice>{readiness.stockNotice}</Notice>
      <p>{siteNeedLine(siteName, shortage.requiredQty, shortage.onHandQty, shortage.shortfallQty, unit)}</p>
      <div className={styles.row}>
        <StatusChip status={shortageState(shortage.state)} appearance="label" />
        {hasEarlierDecision(shortage.actions) ? <StatusChip status={earlierDecision()} appearance="label" /> : null}
      </div>
      <p className={styles.muted}>{decisionScope(count)}</p>
      <div className={styles.row}>
        <WaitDialog siteId={siteId} shortageId={shortage.id} target={materialName} />
        <EscalateDialog siteId={siteId} shortageId={shortage.id} target={materialName} />
      </div>
      <p>{stockFiguresLine(readiness.stockAsOf, readiness.asOf)}</p>
      {stockIsStale(readiness.stockAsOf, readiness.asOf) ? (
        <Banner status={{ label: STOCK_STALE, tone: "warning", icon: "warning" }} />
      ) : null}
      <section className={styles.section} aria-labelledby="planned-heading">
        <h2 id="planned-heading">{plannedAt(siteName, count)}</h2>
        <ul className={styles.list}>
          {places.map((label) => (
            <li key={label} className={styles.plannedPlace}>
              {label}
            </li>
          ))}
        </ul>
        <Link className={styles.affectedLink} href={siteMaterialPath(siteId, shortage.materialId)}>
          {SHOW_ON_SITE_LIST}
          <Icon name="chevron-right" />
        </Link>
      </section>
    </>
  );
}

function unavailable(title: string, backHref: string, backName: string, end?: ReactNode) {
  return (
    <>
      <AppBar backHref={backHref} backName={backName} end={end} />
      <main>
        <h1>{title}</h1>
        <UnavailablePanel status={readinessBanner("unavailable")} />
      </main>
    </>
  );
}
