import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { MaterialSite } from "@/application";
import { IdSchema } from "@/ports";
import { AppBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { Icon } from "@/ui/Icon";
import { StatusChip } from "@/ui/StatusChip";
import { StockFigures } from "@/ui/StockFigures";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { WaitDialog } from "@/ui/decisions/WaitDialog";
import { MATERIALS_PATH, decisionScope, groupPlaces, materialStockLine, penetrationLine, siteAnchor, siteMaterialLine, sitePath } from "@/ui/format";
import { materialBack } from "@/ui/materials";
import { MATERIALS, NAV } from "@/ui/messages";
import { earlierDecision, hasEarlierDecision, shortageState } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { getCachedMaterialDetail } from "../../_lib/cached";
import { loadPage } from "../../_lib/load";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ materialId: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ from?: string | string[] }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { materialId } = await params;
  if (!IdSchema.safeParse(materialId).success) return { title: NAV.materials };
  try {
    return { title: (await getCachedMaterialDetail(materialId)).material.name };
  } catch (error) {
    unstable_rethrow(error);
    return { title: NAV.materials };
  }
}

/** One material across sites (AC 39): the shared stock once, then each site that plans it. */
export default async function MaterialPage({ params, searchParams }: PageProps) {
  const { materialId } = await params;
  const { from } = await searchParams;
  if (!IdSchema.safeParse(materialId).success) notFound();
  // Only a well-formed id is passed on; the use case accepts it only if it is a penetration using this material.
  const fromId = typeof from === "string" && IdSchema.safeParse(from).success ? from : undefined;

  const loaded = await loadPage(() => getCachedMaterialDetail(materialId, fromId));
  if (loaded.status === "unavailable") {
    return (
      <>
        <AppBar backHref={MATERIALS_PATH} backName={NAV.materials} />
        <main>
          <h1>{MATERIALS.detailTitle}</h1>
          <UnavailablePanel status={{ label: MATERIALS.unavailable, tone: "warning", icon: "warning" }} />
        </main>
      </>
    );
  }

  const detail = loaded.value;
  const back = materialBack(detail.back);
  return (
    <>
      <AppBar backHref={back.href} backName={back.name} />
      <main>
        <h1>{detail.material.name}</h1>
        {detail.stockAsOf === null ? null : <StockFigures notice={detail.stockNotice} stockAsOf={detail.stockAsOf} asOf={detail.asOf} />}
        <p>{materialStockLine(detail.material.onHandQty, detail.material.plannedQty, detail.material.unit)}</p>
        {detail.sites.map((site) => (
          <SiteSection key={site.siteId} site={site} materialName={detail.material.name} unit={detail.material.unit} />
        ))}
      </main>
    </>
  );
}

function SiteSection({ site, materialName, unit }: { site: MaterialSite; materialName: string; unit: string }) {
  const anchor = siteAnchor(site.siteId);
  const heading = (
    <h2 id={`${anchor}-heading`}>
      <Link className={styles.headingLink} href={sitePath(site.siteId)}>
        {site.siteName}
        <Icon name="chevron-right" />
      </Link>
    </h2>
  );
  if (site.status === "unavailable") {
    return (
      <section id={anchor} className={styles.section} aria-labelledby={`${anchor}-heading`}>
        {heading}
        <Banner status={{ label: MATERIALS.siteUnavailable, tone: "warning", icon: "warning" }} />
      </section>
    );
  }
  const { shortage } = site;
  const line = siteMaterialLine(site.requiredQty, shortage, unit);
  const places = groupPlaces(site.places.map(penetrationLine));
  // Each site has its own shortage, so each decision names the site as well as the material.
  const target = `${materialName} at ${site.siteName}`;
  return (
    <section id={anchor} className={styles.section} aria-labelledby={`${anchor}-heading`}>
      {heading}
      {shortage ? (
        <StatusChip
          status={shortage.kind === "short" ? { label: line, tone: "danger", icon: "stop" } : { label: line, tone: "warning", icon: "warning" }}
          appearance="label"
        />
      ) : (
        <p>{line}</p>
      )}
      <ul className={styles.list}>
        {places.map((label) => (
          <li key={label} className={styles.plannedPlace}>
            {label}
          </li>
        ))}
      </ul>
      {shortage ? (
        <>
          <p className={styles.muted}>{decisionScope(site.places.length)}</p>
          <div className={styles.row}>
            <StatusChip status={shortageState(shortage.state)} appearance="label" />
            {hasEarlierDecision(shortage.actions) ? <StatusChip status={earlierDecision()} appearance="label" /> : null}
          </div>
          <div className={styles.row}>
            <WaitDialog siteId={site.siteId} shortageId={shortage.id} target={target} />
            <EscalateDialog siteId={site.siteId} shortageId={shortage.id} target={target} />
          </div>
        </>
      ) : null}
    </section>
  );
}
