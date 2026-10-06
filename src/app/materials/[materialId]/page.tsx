import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { AllActions, MaterialSite } from "@/application";
import { IdSchema } from "@/ports";
import { AppBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { Icon } from "@/ui/Icon";
import { KindIcon } from "@/ui/KindIcon";
import { MaterialLog } from "@/ui/MaterialLog";
import { StatusChip } from "@/ui/StatusChip";
import { StockFigures } from "@/ui/StockFigures";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { WaitDialog } from "@/ui/decisions/WaitDialog";
import { MATERIALS_PATH, decisionScope, groupPlaces, materialStockLine, penetrationLine, siteAnchor, siteFromMaterialPath, siteMaterialLine } from "@/ui/format";
import { logBack, logOrigin } from "@/ui/actions-log";
import { materialLog, uncheckedMaterialActions } from "@/ui/material-log";
import { materialTabHref, parseMaterialTab, type MaterialTab } from "@/ui/material-tabs";
import { materialBack } from "@/ui/materials";
import { MATERIAL_LOG, MATERIALS, NAV } from "@/ui/messages";
import { earlierDecision, hasEarlierDecision } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { getCachedAllActions, getCachedMaterialDetail } from "../../_lib/cached";
import { loadPage, type PageLoad } from "../../_lib/load";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ materialId: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ from?: string | string[]; fromLog?: string | string[]; tab?: string | string[] }> };

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

/** One material across sites (AC 39): the shared stock once, then each site that plans it. Actions are a second tab (AC 46). */
export default async function MaterialPage({ params, searchParams }: PageProps) {
  const { materialId } = await params;
  const query = await searchParams;
  if (!IdSchema.safeParse(materialId).success) notFound();
  // Only a well-formed id is passed on; the use case accepts it only if it is a penetration using this material.
  const fromId = typeof query.from === "string" && IdSchema.safeParse(query.from).success ? query.from : undefined;
  const tab = parseMaterialTab(query.tab);

  const loaded = await loadPage(() => getCachedMaterialDetail(materialId, fromId));
  // The tab count needs the log on both tabs. A failed log read must not hide the stock.
  const actionsLoad = await loadPage(() => getCachedAllActions());
  const log = actionsLoad.status === "ready" ? materialLog(actionsLoad.value.sites, materialId) : null;
  const logCount = log !== null && log.uncheckedSites.length === 0 ? log.entries.length : null;

  if (loaded.status === "unavailable") {
    return (
      <>
        <AppBar backHref={MATERIALS_PATH} backName={NAV.materials} />
        <main>
          <h1>{MATERIALS.detailTitle}</h1>
          <MaterialTabs materialId={materialId} tab={tab} count={logCount} />
          {tab === "log" ? <MaterialLogSection materialId={materialId} actionsLoad={actionsLoad} /> : <UnavailablePanel status={{ label: MATERIALS.unavailable, tone: "warning", icon: "warning" }} />}
        </main>
      </>
    );
  }

  const detail = loaded.value;
  // Back to the penetration that opened this page, else to the actions log it was opened from, else Materials.
  const logSite = logOrigin(query.fromLog, detail.sites.map((site) => site.siteId));
  const back = detail.back || logSite === undefined ? materialBack(detail.back) : logBack(logSite);
  const keptFrom = detail.back?.penetrationId;
  return (
    <>
      <AppBar backHref={back.href} backName={back.name} />
      <main>
        <h1>{detail.material.name}</h1>
        <MaterialTabs materialId={materialId} tab={tab} count={logCount} from={keptFrom} fromLog={logSite} />
        {tab === "log" ? (
          <MaterialLogSection materialId={materialId} actionsLoad={actionsLoad} />
        ) : (
          <>
            {detail.stockAsOf === null ? null : <StockFigures notice={detail.stockNotice} stockAsOf={detail.stockAsOf} asOf={detail.asOf} />}
            <p>{materialStockLine(detail.material.onHandQty, detail.material.plannedQty, detail.material.unit)}</p>
            {detail.sites.map((site) => (
              <SiteSection key={site.siteId} site={site} materialId={detail.material.id} materialName={detail.material.name} unit={detail.material.unit} />
            ))}
          </>
        )}
      </main>
    </>
  );
}

function MaterialTabs({
  materialId,
  tab,
  count,
  from,
  fromLog,
}: {
  materialId: string;
  tab: MaterialTab;
  count: number | null;
  from?: string;
  fromLog?: string;
}) {
  return (
    <nav className={styles.tabBar} aria-label="Material">
      <Link className={styles.tab} href={materialTabHref(materialId, "stock", from, fromLog)} aria-current={tab === "stock" ? "page" : undefined}>
        Stock
      </Link>
      <Link className={styles.tab} href={materialTabHref(materialId, "log", from, fromLog)} aria-current={tab === "log" ? "page" : undefined}>
        <span>{NAV.actions}</span>
        {count === null ? null : <span className={styles.tabCount}>{count}</span>}
      </Link>
    </nav>
  );
}

function MaterialLogSection({ materialId, actionsLoad }: { materialId: string; actionsLoad: PageLoad<AllActions> }) {
  const log = actionsLoad.status === "ready" ? materialLog(actionsLoad.value.sites, materialId) : null;
  return (
    <section className={styles.section} aria-labelledby="material-log-heading">
      <h2 id="material-log-heading" className={styles.srOnly}>
        {NAV.actions}
      </h2>
      {log === null ? (
        <UnavailablePanel status={{ label: MATERIAL_LOG.unavailable, tone: "warning", icon: "warning" }} />
      ) : (
        <>
          {log.uncheckedSites.length > 0 ? (
            <Banner status={{ label: uncheckedMaterialActions(log.uncheckedSites.length), tone: "warning", icon: "warning" }} />
          ) : null}
          {log.entries.length > 0 ? <MaterialLog entries={log.entries} /> : log.uncheckedSites.length === 0 ? <p>{MATERIAL_LOG.empty}</p> : null}
        </>
      )}
    </section>
  );
}

function SiteSection({
  site,
  materialId,
  materialName,
  unit,
}: {
  site: MaterialSite;
  materialId: string;
  materialName: string;
  unit: string;
}) {
  const anchor = siteAnchor(site.siteId);
  const heading = (
    <h2 id={`${anchor}-heading`}>
      <Link className={styles.headingLink} href={siteFromMaterialPath(site.siteId, materialId)}>
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
            <span className={styles.kindTitle}>
              <KindIcon kind="penetration" />
              <span>{label}</span>
            </span>
          </li>
        ))}
      </ul>
      {shortage ? (
        <>
          <p className={styles.muted}>{decisionScope(site.places.length)}</p>
          {hasEarlierDecision(shortage.actions) ? <StatusChip status={earlierDecision()} appearance="label" /> : null}
          <div className={styles.row}>
            <WaitDialog siteId={site.siteId} shortageId={shortage.id} target={target} />
            <EscalateDialog siteId={site.siteId} shortageId={shortage.id} target={target} />
          </div>
        </>
      ) : null}
    </section>
  );
}
