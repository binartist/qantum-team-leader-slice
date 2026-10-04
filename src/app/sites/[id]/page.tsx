import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { SiteReadinessView } from "@/application";
import { SiteNotFoundError } from "@/ports";
import { getCachedReadiness, getCachedSite } from "../../_lib/cached";
import { Banner } from "@/ui/Banner";
import { BlockerCard } from "@/ui/BlockerCard";
import { LinkButton } from "@/ui/LinkButton";
import { Notice } from "@/ui/Notice";
import { ShortageCard } from "@/ui/ShortageCard";
import { actionsPath, formatAsOf } from "@/ui/format";
import { BUTTONS, readinessBanner } from "@/ui/messages";
import { hasEarlierDecision } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../_lib/load";

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
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") {
    return (
      <main>
        <LinkButton href="/">{BUTTONS.backToSites}</LinkButton>
        <h1>This site</h1>
        <Banner status={readinessBanner("unavailable", 0, 0)} />
      </main>
    );
  }

  const readinessLoad = await loadPage(() => getCachedReadiness(id));
  const site = siteLoad.value;
  if (readinessLoad.status === "unavailable") {
    return (
      <main>
        <LinkButton href="/">{BUTTONS.backToSites}</LinkButton>
        <h1>{site.name}</h1>
        <p className={styles.muted}>{site.reference}</p>
        <Banner status={readinessBanner("unavailable", 0, 0)} />
      </main>
    );
  }

  const readiness = readinessLoad.value;
  return (
    <main>
      <LinkButton href="/">{BUTTONS.backToSites}</LinkButton>
      <h1>{site.name}</h1>
      <p className={styles.muted}>{site.reference}</p>
      <Banner status={readinessBanner(readiness.crewStatus, readiness.shortages.length, readiness.blockers.length)} />
      <Notice>{readiness.stockNotice}</Notice>
      <p>{formatAsOf(readiness.stockAsOf)}</p>
      {readiness.shortages.length > 0 ? (
        <ul className={styles.list}>
          {readiness.shortages.map((shortage) => {
            const material = readiness.materials[shortage.materialId];
            return (
              <li key={shortage.id}>
                <ShortageCard
                  siteId={site.id}
                  shortageId={shortage.id}
                  materialName={material?.name ?? shortage.materialId}
                  requiredQty={shortage.requiredQty}
                  onHandQty={shortage.onHandQty}
                  shortfallQty={shortage.shortfallQty}
                  unit={material?.unit ?? ""}
                  state={shortage.state}
                  earlier={hasEarlierDecision(shortage.actions)}
                  places={shortage.penetrationIds.map((penetrationId) => ({
                    id: penetrationId,
                    label: placeLabel(readiness, penetrationId),
                  }))}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
      {readiness.blockers.length > 0 ? (
        <section>
          <h2>Data problems</h2>
          <ul className={styles.list}>
            {readiness.blockers.map((blocker) => (
              <li key={blocker.id}>
                <BlockerCard
                  siteId={site.id}
                  blockerId={blocker.id}
                  penetrationId={blocker.penetrationId}
                  place={placeLabel(readiness, blocker.penetrationId)}
                  reason={blocker.reason}
                  code={blocker.internalCode}
                  state={blocker.state}
                  earlier={hasEarlierDecision(blocker.actions)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <LinkButton href={actionsPath(site.id)}>{BUTTONS.actionsLog}</LinkButton>
    </main>
  );
}

function placeLabel(readiness: SiteReadinessView, penetrationId: string): string {
  const place = readiness.penetrations[penetrationId];
  if (!place) return penetrationId;
  return `${place.floor}, ${place.location}`;
}
