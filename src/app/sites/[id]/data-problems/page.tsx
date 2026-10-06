import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { SiteReadinessView } from "@/application";
import { getCachedSite } from "../../../_lib/cached";
import { BlockerCard } from "@/ui/BlockerCard";
import { EMPTY, TABS } from "@/ui/messages";
import { hasEarlierDecision } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { loadSiteFrame, SiteFrame } from "../site-frame";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { id } = await params;
  try {
    const site = await getCachedSite(id);
    return { title: site ? `${site.name} data problems` : "Data problems" };
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Data problems" };
  }
}

export default async function DataProblemsPage({ params }: RouteParams) {
  const { id } = await params;
  const frame = await loadSiteFrame(id);
  return (
    <SiteFrame frame={frame} current="data-problems">
      {frame.status === "ready" && frame.readiness ? (
        <DataProblems siteId={frame.site.id} readiness={frame.readiness} />
      ) : null}
    </SiteFrame>
  );
}

function DataProblems({ siteId, readiness }: { siteId: string; readiness: SiteReadinessView }) {
  return (
    <section aria-labelledby="data-problems-heading">
      <h2 id="data-problems-heading" className={styles.srOnly}>
        {TABS.dataProblems}
      </h2>
      {readiness.blockers.length === 0 ? (
        <p>{EMPTY.dataProblems}</p>
      ) : (
        <ul className={styles.list}>
          {readiness.blockers.map((blocker) => (
            <li key={blocker.id}>
              <BlockerCard
                siteId={siteId}
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
      )}
    </section>
  );
}

function placeLabel(readiness: SiteReadinessView, penetrationId: string): string {
  const place = readiness.penetrations[penetrationId];
  if (!place) return penetrationId;
  return `${place.floor}, ${place.location}`;
}
