import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { CandidateList, SiteReadinessView } from "@/application";
import { FitTable } from "@/ui/FitTable";
import { fitRows } from "@/ui/fit";
import { SiteNotFoundError } from "@/ports";
import { getCachedCandidates, getCachedPenetrationDetail, getCachedReadiness, getCachedSite } from "../../../../_lib/cached";
import { KindIcon } from "@/ui/KindIcon";
import { AppBar } from "@/ui/AppBar";
import { CandidateCard } from "@/ui/CandidateCard";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { formatMaterialSummary, ratingValue, sitePath, serviceLine } from "@/ui/format";
import { Notice } from "@/ui/Notice";
import { readinessBanner } from "@/ui/messages";
import { candidateStatus, emptyCatalogueLabel, type StatusView } from "@/ui/status";
import { StatusChip } from "@/ui/StatusChip";
import { penetrationFacts } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../../../_lib/load";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; pid: string }> };

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

export default async function PenetrationPage({ params }: RouteParams) {
  const { id, pid } = await params;
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return unavailable("This site", "/sites", "Sites");

  const listedLoad = await loadPage(() => getCachedCandidates(id, pid));
  if (listedLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name);
  const readinessLoad = await loadPage(() => getCachedReadiness(id));
  if (readinessLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name);
  const detailLoad = await loadPage(() => getCachedPenetrationDetail(id, pid));
  if (detailLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name);
  const detail = detailLoad.value;

  const listed = listedLoad.value;
  const readiness = readinessLoad.value;
  const penetration = listed.penetration;
  const facts = penetrationFacts(pid, readiness.shortages, readiness.blockers, readiness.materials);
  const hasCandidates = listed.status === "ok" && listed.candidates.length > 0;
  const related = hasCandidates ? [] : relatedDecisions(readiness, pid);
  const empty = hasCandidates ? null : emptyState(listed.status, related.length > 0);

  return (
    <>
      <AppBar backHref={sitePath(id)} backName={siteLoad.value.name} />
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
                  <StatusChip status={fact} appearance="label" />
                </li>
              ))}
            </ul>
          )}
          {detail.nominated ? (
            <FitTable code={penetration.nominatedCode} rows={fitRows(detail.penetration, detail.nominated, detail.mismatches)} />
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
              <ul className={styles.list}>
                {listed.candidates.map((candidate) => (
                  <li key={candidate.internalCode}>
                    <CandidateCard
                      siteId={id}
                      penetrationId={pid}
                      fromCode={listed.nominatedCode}
                      toCode={candidate.internalCode}
                      integrityMinutes={candidate.integrityMinutes}
                      insulationMinutes={candidate.insulationMinutes}
                      requiredIntegrityMinutes={penetration.requiredIntegrityMinutes}
                      requiredInsulationMinutes={penetration.requiredInsulationMinutes}
                      supplierRefCode={candidate.supplierRefCode}
                      overall={candidate.availability.overall}
                      summary={formatMaterialSummary(candidate.availability.lines, candidate.materials)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {empty ? <StatusChip status={empty} appearance="label" /> : null}
          {related.length > 0 ? (
            <ul className={styles.list}>
              {related.map((item) => (
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

function relatedDecisions(readiness: SiteReadinessView, penetrationId: string): { id: string; target: string }[] {
  const shortages = readiness.shortages
    .filter((shortage) => shortage.penetrationIds.includes(penetrationId))
    .map((shortage) => ({
      id: shortage.id,
      target: readiness.materials[shortage.materialId]?.name ?? shortage.materialId,
    }));
  const blockers = readiness.blockers
    .filter((blocker) => blocker.penetrationId === penetrationId)
    .map((blocker) => {
      const place = readiness.penetrations[blocker.penetrationId];
      return { id: blocker.id, target: place ? `${place.floor}, ${place.location}` : blocker.penetrationId };
    });
  return [...shortages, ...blockers];
}
