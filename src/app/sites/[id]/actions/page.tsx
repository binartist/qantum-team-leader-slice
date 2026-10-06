import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { SiteActions } from "@/application";
import { getCachedActions, getCachedSite } from "../../../_lib/cached";
import { ActionRow, ProposalRow } from "@/ui/ActionRow";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { actionTarget, actionSentence } from "@/ui/format";
import { EMPTY, readinessBanner } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../../_lib/load";
import { loadSiteFrame, SiteFrame } from "../site-frame";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { id } = await params;
  try {
    const site = await getCachedSite(id);
    return { title: site ? `${site.name} actions` : "Actions" };
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Actions" };
  }
}

export default async function ActionsPage({ params }: RouteParams) {
  const { id } = await params;
  const frame = await loadSiteFrame(id);
  if (frame.status === "unavailable") return <SiteFrame frame={frame} current="actions">{null}</SiteFrame>;
  const actionsLoad = await loadPage(() => getCachedActions(id));
  const site = frame.site;
  return (
    <SiteFrame frame={frame} current="actions">
      {actionsLoad.status === "unavailable" ? (
        // The frame already shows the panel when readiness is down too; one is enough.
        frame.readiness ? <UnavailablePanel status={readinessBanner("unavailable")} /> : null
      ) : (
        <ActionsLog siteId={site.id} listed={actionsLoad.value} />
      )}
    </SiteFrame>
  );
}

function ActionsLog({ siteId, listed }: { siteId: string; listed: SiteActions }) {
  const empty = listed.actions.length === 0 && listed.proposals.length === 0;
  return (
    <>
      {empty ? <p>{EMPTY.actions}</p> : null}
      {listed.actions.length > 0 ? (
        <section>
          <h2>Recorded actions</h2>
          <ul className={styles.list}>
            {listed.actions.map((action) => {
              const target = actionTarget(siteId, action.shortageId, listed.materials, listed.penetrations);
              return (
                <li key={action.id}>
                  <ActionRow
                    sentence={actionSentence(action.kind, action.escalateTo, target)}
                    recordedAt={action.createdAt}
                    createdBy={action.createdBy}
                    note={action.note}
                    status={action.status}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {listed.proposals.length > 0 ? (
        <section>
          <h2>Proposed substitutes</h2>
          <ul className={styles.list}>
            {listed.proposals.map((proposal) => (
              <li key={proposal.id}>
                <ProposalRow
                  fromCode={proposal.fromInternalCode}
                  toCode={proposal.toInternalCode}
                  reason={proposal.reason}
                  recordedAt={proposal.createdAt}
                  createdBy={proposal.createdBy}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
