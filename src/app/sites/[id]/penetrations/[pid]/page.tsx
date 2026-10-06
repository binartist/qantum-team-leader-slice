import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { CandidateList, SiteReadinessView } from "@/application";
import { FitTable } from "@/ui/FitTable";
import { SubstituteSwitcher } from "@/ui/SubstituteSwitcher";
import { fitRows } from "@/ui/fit";
import { SiteNotFoundError } from "@/ports";
import { getCachedActions, getCachedCandidates, getCachedPenetrationDetail, getCachedReadiness, getCachedSite } from "../../../../_lib/cached";
import { KindIcon } from "@/ui/KindIcon";
import { logBack, logOrigin } from "@/ui/actions-log";
import { AppBar } from "@/ui/AppBar";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { ratingValue, sitePath, serviceLine } from "@/ui/format";
import { FactLine } from "@/ui/FactLine";
import { Notice } from "@/ui/Notice";
import { NAV, PENETRATION_LOG, readinessBanner } from "@/ui/messages";
import { PenetrationLog } from "@/ui/PenetrationLog";
import { penetrationLog } from "@/ui/penetration-log";
import { parsePenetrationTab, penetrationTabHref } from "@/ui/penetration-tabs";
import { candidateStatus, emptyCatalogueLabel, type StatusView } from "@/ui/status";
import { StatusChip } from "@/ui/StatusChip";
import { candidateFacts, penetrationFacts } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../../../_lib/load";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; pid: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ fromLog?: string | string[]; tab?: string | string[] }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  await connection();
  const { id, pid } = await params;
  try {
    const listed = await getCachedCandidates(id, pid);
    return { title: `${listed.penetration.floor}, ${listed.penetration.location}` };
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Penetration" };
  }
}

export default async function PenetrationPage({ params, searchParams }: PageProps) {
  const { id, pid } = await params;
  const query = await searchParams;
  const origin = logOrigin(query.fromLog, [id]);
  const tab = parsePenetrationTab(query.tab);
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return unavailable("This site", "/sites", "Sites");
  // Back to the actions log when it opened this page, else up to the site.
  const back = origin ? logBack(id) : { href: sitePath(id), name: siteLoad.value.name };

  const listedLoad = await loadPage(() => getCachedCandidates(id, pid));
  if (listedLoad.status === "unavailable") return unavailable(siteLoad.value.name, back.href, back.name);
  const readinessLoad = await loadPage(() => getCachedReadiness(id));
  if (readinessLoad.status === "unavailable") return unavailable(siteLoad.value.name, back.href, back.name);
  const detailLoad = await loadPage(() => getCachedPenetrationDetail(id, pid));
  if (detailLoad.status === "unavailable") return unavailable(siteLoad.value.name, back.href, back.name);
  const detail = detailLoad.value;
  const actionsLoad = await loadPage(() => getCachedActions(id));
  const entries = actionsLoad.status === "ready" ? penetrationLog(actionsLoad.value, id, pid, detail.materialIds) : [];
  const logCount = actionsLoad.status === "ready" ? entries.length : null;

  const listed = listedLoad.value;
  const readiness = readinessLoad.value;
  const penetration = listed.penetration;
  const facts = penetrationFacts({ siteId: id, penetrationId: pid }, readiness.shortages, readiness.blockers, readiness.materials);
  const hasCandidates = listed.status === "ok" && listed.candidates.length > 0;
  // A data problem is escalated here, even when substitutes exist. A material shortage is decided on its
  // material page, which the shortage line links to.
  const blockers = blockerDecisions(readiness, pid);
  const empty = hasCandidates ? null : emptyState(listed.status, blockers.length > 0);

  return (
    <>
      <AppBar backHref={back.href} backName={back.name} />
      <main>
        <h1>{`${detail.penetration.floor}, ${detail.penetration.location}`}</h1>
        <nav className={styles.tabBar} aria-label="Penetration">
          <Link className={styles.tab} href={penetrationTabHref(id, pid, "solution", origin)} aria-current={tab === "solution" ? "page" : undefined}>
            Solution
          </Link>
          <Link className={styles.tab} href={penetrationTabHref(id, pid, "log", origin)} aria-current={tab === "log" ? "page" : undefined}>
            <span>{NAV.actions}</span>
            {logCount === null ? null : <span className={styles.tabCount}>{logCount}</span>}
          </Link>
        </nav>

        {tab === "log" ? (
          <section className={styles.section} aria-labelledby="penetration-log-heading">
            <h2 id="penetration-log-heading" className={styles.srOnly}>
              {NAV.actions}
            </h2>
            {actionsLoad.status === "unavailable" ? (
              <UnavailablePanel status={{ label: PENETRATION_LOG.unavailable, tone: "warning", icon: "warning" }} />
            ) : (
              <PenetrationLog entries={entries} shortages={readiness.shortages} />
            )}
          </section>
        ) : null}

        {tab === "solution" ? (
          <>
            <section className={styles.section} aria-labelledby="nominated-heading">
              <h2 id="nominated-heading" className={styles.kindTitle}>
                <KindIcon kind="solution" />
                {`Nominated solution ${penetration.nominatedCode}`}
              </h2>
              {facts.length === 0 ? null : (
                <ul className={styles.list}>
                  {facts.map((fact) => (
                    <li key={fact.label}>
                      <FactLine fact={fact} />
                    </li>
                  ))}
                </ul>
              )}
              {detail.nominated ? (
                <FitTable
                  code={penetration.nominatedCode}
                  rows={fitRows(detail.penetration, { ...detail.nominated, materialNames: detail.materialNames }, detail.mismatches)}
                />
              ) : (
                <dl className={styles.fields}>
                  <dt>Service</dt>
                  <dd>{serviceLine(penetration)}</dd>
                  <dt>Required rating</dt>
                  <dd>{ratingValue(penetration.requiredIntegrityMinutes, penetration.requiredInsulationMinutes)}</dd>
                </dl>
              )}
            </section>

            <section className={styles.section} aria-labelledby="substitutes-heading">
              <h2 id="substitutes-heading">Substitutes</h2>
              {hasCandidates ? (
                <>
                  <Notice>{listed.notice}</Notice>
                  <SubstituteSwitcher
                    siteId={id}
                    penetrationId={pid}
                    fromCode={listed.nominatedCode}
                    choices={listed.candidates.map((candidate) => ({
                      code: candidate.internalCode,
                      facts: candidateFacts(candidate.availability, candidate.materials, readiness.shortages, { siteId: id, penetrationId: pid }),
                      rows: fitRows(
                        detail.penetration,
                        {
                          ...candidate,
                          materialNames: candidate.availability.lines.map((line) => candidate.materials[line.materialId]?.name ?? line.materialId),
                        },
                        candidate.mismatches,
                      ),
                    }))}
                  />
                </>
              ) : null}
              {empty ? <StatusChip status={empty} appearance="label" /> : null}
              {blockers.length > 0 ? (
                <ul className={styles.list}>
                  {blockers.map((item) => (
                    <li key={item.id}>
                      <EscalateDialog siteId={id} shortageId={item.id} target={item.target} prominent />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}

/** Why there are no substitutes, as a status line. A plain miss is neutral; a catalogue gap is a warning. */
function emptyState(status: CandidateList["status"], hasRelated: boolean): StatusView {
  if (status !== "ok") return candidateStatus(status);
  return { label: emptyCatalogueLabel(hasRelated), tone: "neutral", icon: "dashed-circle" };
}

function unavailable(title: string, backHref: string, backName: string) {
  return (
    <>
      <AppBar backHref={backHref} backName={backName} />
      <main>
        <h1>{title}</h1>
        <UnavailablePanel status={readinessBanner("unavailable")} />
      </main>
    </>
  );
}

function blockerDecisions(readiness: SiteReadinessView, penetrationId: string): { id: string; target: string }[] {
  return readiness.blockers
    .filter((blocker) => blocker.penetrationId === penetrationId)
    .map((blocker) => {
      const place = readiness.penetrations[blocker.penetrationId];
      return { id: blocker.id, target: place ? `${place.floor}, ${place.location}` : blocker.penetrationId };
    });
}
