import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { SiteReadinessView } from "@/application";
import { getCachedSite } from "../../_lib/cached";
import { Banner } from "@/ui/Banner";
import { Notice } from "@/ui/Notice";
import { ShortageCard } from "@/ui/ShortageCard";
import { stockFiguresLine, stockIsStale } from "@/ui/format";
import { EMPTY, STOCK_STALE } from "@/ui/messages";
import { hasEarlierDecision } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { loadSiteFrame, SiteFrame } from "./site-frame";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

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

export default async function SitePage({ params }: RouteParams) {
  const { id } = await params;
  const frame = await loadSiteFrame(id);
  return (
    <SiteFrame frame={frame} current="shortages">
      {frame.status === "ready" && frame.readiness ? <Shortages siteId={frame.site.id} readiness={frame.readiness} /> : null}
    </SiteFrame>
  );
}

function Shortages({ siteId, readiness }: { siteId: string; readiness: SiteReadinessView }) {
  if (readiness.crewStatus === "nothing_planned") return <p>{EMPTY.shortages}</p>;
  return (
    <>
      <Notice>{readiness.stockNotice}</Notice>
      <p>{stockFiguresLine(readiness.stockAsOf, readiness.asOf)}</p>
      {stockIsStale(readiness.stockAsOf, readiness.asOf) ? (
        <Banner status={{ label: STOCK_STALE, tone: "warning", icon: "warning" }} />
      ) : null}
      {readiness.shortages.length === 0 ? <p>{EMPTY.shortages}</p> : null}
      {readiness.shortages.length > 0 ? (
        <ul className={styles.list}>
          {readiness.shortages.map((shortage) => {
            const material = readiness.materials[shortage.materialId];
            return (
              <li key={shortage.id}>
                <ShortageCard
                  siteId={siteId}
                  shortageId={shortage.id}
                  materialName={material?.name ?? shortage.materialId}
                  requiredQty={shortage.requiredQty}
                  onHandQty={shortage.onHandQty}
                  shortfallQty={shortage.shortfallQty}
                  unit={material?.unit ?? ""}
                  state={shortage.state}
                  earlier={hasEarlierDecision(shortage.actions)}
                  materialId={shortage.materialId}
                  affected={shortage.penetrationIds.length}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
