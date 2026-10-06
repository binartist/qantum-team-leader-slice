import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { SiteReadinessView } from "@/application";
import { SiteNotFoundError } from "@/ports";
import { getCachedCandidates, getCachedReadiness, getCachedSite } from "../../../../_lib/cached";
import { AppBar } from "@/ui/AppBar";
import { CandidateCard } from "@/ui/CandidateCard";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { EscalateDialog } from "@/ui/decisions/EscalateDialog";
import { formatMaterialSummary, formatRating, sitePath, actionsPath, serviceLine } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { Notice } from "@/ui/Notice";
import { BUTTONS, readinessBanner } from "@/ui/messages";
import { candidateStatus, emptyCatalogueLabel } from "@/ui/status";
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
    return { title: "Substitutes" };
  }
}

export default async function SubstitutesPage({ params }: RouteParams) {
  const { id, pid } = await params;
  const siteLoad = await loadPage(async () => {
    const site = await getCachedSite(id);
    if (!site) throw new SiteNotFoundError();
    return site;
  });
  if (siteLoad.status === "unavailable") return unavailable("This site", "/", "Sites");

  const listedLoad = await loadPage(() => getCachedCandidates(id, pid));
  if (listedLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name);

  const listed = listedLoad.value;
  const needsEscalate = listed.status !== "ok" || listed.candidates.length === 0;
  let related: { id: string; target: string }[] = [];
  if (needsEscalate) {
    const readinessLoad = await loadPage(() => getCachedReadiness(id));
    if (readinessLoad.status === "unavailable") return unavailable(siteLoad.value.name, sitePath(id), siteLoad.value.name);
    related = relatedDecisions(readinessLoad.value, pid);
  }

  const penetration = listed.penetration;
  const message =
    listed.status === "ok"
      ? listed.candidates.length === 0
        ? emptyCatalogueLabel(related.length > 0)
        : null
      : candidateStatus(listed.status).label;

  return (
    <>
      <AppBar backHref={sitePath(id)} backName={siteLoad.value.name} />
      <main>
        <h1>Substitutes</h1>
        <p>{`${penetration.floor}, ${penetration.location}`}</p>
        <p>{serviceLine(penetration)}</p>
        <p>{`Nominated solution ${penetration.nominatedCode}`}</p>
        <p>{formatRating(penetration.requiredIntegrityMinutes, penetration.requiredInsulationMinutes)}</p>
        {listed.candidates.length > 0 ? <Notice>{listed.notice}</Notice> : null}
        {message ? <p>{message}</p> : null}
        {needsEscalate && related.length > 0 ? (
          <ul className={styles.list}>
            {related.map((item) => (
              <li key={item.id}>
                <EscalateDialog siteId={id} shortageId={item.id} target={item.target} />
              </li>
            ))}
          </ul>
        ) : null}
        {listed.status === "ok" && listed.candidates.length > 0 ? (
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
        ) : null}
        <LinkButton href={actionsPath(id)}>{BUTTONS.actionsLog}</LinkButton>
      </main>
    </>
  );
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
