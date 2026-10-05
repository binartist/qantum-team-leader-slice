import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { listActions } from "@/application";
import { SiteNotFoundError } from "@/ports";
import { getDependencies } from "@/server/deps";
import { getCachedSite } from "../../../_lib/cached";
import { AppBar } from "@/ui/AppBar";
import { ActionRow, ProposalRow } from "@/ui/ActionRow";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { actionTarget, actionSentence, sitePath } from "@/ui/format";
import { EMPTY, readinessBanner } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../../_lib/load";

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
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") {
    return (
      <>
        <AppBar title="This site" backHref="/sites" backName="Sites" />
        <main>
          <UnavailablePanel status={readinessBanner("unavailable", 0, 0)} />
        </main>
      </>
    );
  }

  const actionsLoad = await loadPage(() => listActions(getDependencies(), id));
  const site = siteLoad.value;
  if (actionsLoad.status === "unavailable") {
    return (
      <>
        <AppBar title={site.name} backHref={sitePath(site.id)} backName={site.name} />
        <main>
          <UnavailablePanel status={readinessBanner("unavailable", 0, 0)} />
        </main>
      </>
    );
  }

  const listed = actionsLoad.value;
  const empty = listed.actions.length === 0 && listed.proposals.length === 0;
  return (
    <>
      <AppBar title="Actions log" backHref={sitePath(site.id)} backName={site.name} />
      <main>
        {empty ? <p>{EMPTY.actions}</p> : null}
        {listed.actions.length > 0 ? (
          <section>
            <h2>Recorded actions</h2>
            <ul className={styles.list}>
              {listed.actions.map((action) => {
                const target = actionTarget(site.id, action.shortageId, listed.materials, listed.penetrations);
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
      </main>
    </>
  );
}
