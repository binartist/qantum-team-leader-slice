import type { Metadata } from "next";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { CandidateList, CandidateView, SiteReadinessView } from "@/application";
import { FitTable } from "@/ui/FitTable";
import { SubstituteSwitcher } from "@/ui/SubstituteSwitcher";
import { fitRows } from "@/ui/fit";
import { SiteNotFoundError } from "@/ports";
import { getCachedCandidates, getCachedPenetrationDetail, getCachedReadiness, getCachedSite } from "../../../../_lib/cached";
import { KindIcon } from "@/ui/KindIcon";
import { AppBar } from "@/ui/AppBar";
import { logIsOpen } from "@/ui/penetration-filters";
import { SiteActionsButton } from "../../site-actions";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { materialPath, ratingValue, sitePath, serviceLine } from "@/ui/format";
import { FactLine } from "@/ui/FactLine";
import { Notice } from "@/ui/Notice";
import { readinessBanner } from "@/ui/messages";
import { availabilityStatus, candidateStatus, emptyCatalogueLabel, type StatusView } from "@/ui/status";
import { StatusChip } from "@/ui/StatusChip";
import { penetrationFacts, type PenetrationFact } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../../../_lib/load";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; pid: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ log?: string | string[] }> };

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
  const { log } = await searchParams;
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return unavailable("This site", "/sites", "Sites");
  const actions = <SiteActionsButton siteId={siteLoad.value.id} initialOpen={logIsOpen(log)} />;

  const listedLoad = await loadPage(() => getCachedCandidates(id, pid));
  if (listedLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name, actions);
  const readinessLoad = await loadPage(() => getCachedReadiness(id));
  if (readinessLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name, actions);
  const detailLoad = await loadPage(() => getCachedPenetrationDetail(id, pid));
  if (detailLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name, actions);
  const detail = detailLoad.value;

  const listed = listedLoad.value;
  const readiness = readinessLoad.value;
  const penetration = listed.penetration;
  const facts = penetrationFacts(pid, readiness.shortages, readiness.blockers, readiness.materials, id);
  const hasCandidates = listed.status === "ok" && listed.candidates.length > 0;
  // A data problem is escalated here, even when substitutes exist. A material shortage is decided on its stock page.
  const blockers = blockerDecisions(readiness, pid);
  const empty = hasCandidates ? null : emptyState(listed.status, blockers.length > 0);

  return (
    <>
      <AppBar backHref={sitePath(id)} backName={siteLoad.value.name} end={actions} />
      <main>
        <h1>{`${detail.penetration.floor}, ${detail.penetration.location}`}</h1>

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
                  facts: candidateFacts(candidate, id),
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
      </main>
    </>
  );
}

/** Problem lines for one substitute, in the same shape as the nominated solution. In-stock materials are not listed. */
function candidateFacts(candidate: CandidateView, siteId: string): PenetrationFact[] {
  const facts: PenetrationFact[] = [];
  for (const line of candidate.availability.lines) {
    if (line.status === "in_stock") continue;
    const name = candidate.materials[line.materialId]?.name ?? line.materialId;
    if (line.status === "short") {
      facts.push({
        label: `Short material: ${name}`,
        tone: "danger",
        icon: "stop",
        href: materialPath(siteId, line.materialId),
      });
    } else {
      facts.push({ label: `Stock unknown: ${name}`, tone: "warning", icon: "warning" });
    }
  }
  if (facts.length === 0 && candidate.availability.overall !== "in_stock") {
    facts.push(availabilityStatus(candidate.availability.overall));
  }
  return facts;
}

/** Why there are no substitutes, as a status line. A plain miss is neutral; a catalogue gap is a warning. */
function emptyState(status: CandidateList["status"], hasRelated: boolean): StatusView {
  if (status !== "ok") return candidateStatus(status);
  return { label: emptyCatalogueLabel(hasRelated), tone: "neutral", icon: "dashed-circle" };
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

function blockerDecisions(readiness: SiteReadinessView, penetrationId: string): { id: string; target: string }[] {
  return readiness.blockers
    .filter((blocker) => blocker.penetrationId === penetrationId)
    .map((blocker) => {
      const place = readiness.penetrations[blocker.penetrationId];
      return { id: blocker.id, target: place ? `${place.floor}, ${place.location}` : blocker.penetrationId };
    });
}
