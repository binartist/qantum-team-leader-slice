import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { CandidateList, SiteReadinessView } from "@/application";
import { FitTable } from "@/ui/FitTable";
import { SubstituteSwitcher } from "@/ui/SubstituteSwitcher";
import { fitRows } from "@/ui/fit";
import { SiteNotFoundError } from "@/ports";
import { getCachedCandidates, getCachedPenetrationDetail, getCachedReadiness, getCachedSite } from "../../../../_lib/cached";
import { KindIcon } from "@/ui/KindIcon";
import { logBack, logOrigin } from "@/ui/actions-log";
import { AppBar } from "@/ui/AppBar";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { ratingValue, sitePath, serviceLine } from "@/ui/format";
import { FactLine } from "@/ui/FactLine";
import { Notice } from "@/ui/Notice";
import { readinessBanner } from "@/ui/messages";
import { candidateStatus, emptyCatalogueLabel, type StatusView } from "@/ui/status";
import { StatusChip } from "@/ui/StatusChip";
import { candidateFacts, penetrationFacts } from "@/ui/penetrations";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../../../../_lib/load";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; pid: string }> };
type PageProps = RouteParams & { searchParams: Promise<{ fromLog?: string | string[] }> };

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
  const { fromLog } = await searchParams;
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return unavailable("This site", "/sites", "Sites");
  // Back to the actions log when it opened this page, else up to the site.
  const back = logOrigin(fromLog, [id]) ? logBack(id) : { href: sitePath(id), name: siteLoad.value.name };

  const listedLoad = await loadPage(() => getCachedCandidates(id, pid));
  if (listedLoad.status === "unavailable") return unavailable(siteLoad.value.name, back.href, back.name);
  const readinessLoad = await loadPage(() => getCachedReadiness(id));
  if (readinessLoad.status === "unavailable") return unavailable(siteLoad.value.name, back.href, back.name);
  const detailLoad = await loadPage(() => getCachedPenetrationDetail(id, pid));
  if (detailLoad.status === "unavailable") return unavailable(siteLoad.value.name, back.href, back.name);
  const detail = detailLoad.value;

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
