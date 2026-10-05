import type { CrewStatus } from "@/domain";
import { UpstreamError, type Site } from "@/ports";
import { log } from "./log";
import { getSiteReadiness } from "./readiness";
import type { Dependencies } from "./types";

export interface ListedSite extends Site {
  readonly crewStatus: CrewStatus | "unavailable";
  readonly shortageCount: number;
  readonly dataProblemCount: number;
}

function siteCounts(crewStatus: CrewStatus, shortageCount: number, dataProblemCount: number): Pick<ListedSite, "shortageCount" | "dataProblemCount"> {
  if (crewStatus !== "blocked") return { shortageCount: 0, dataProblemCount: 0 };
  return { shortageCount, dataProblemCount };
}

export async function listSites(deps: Dependencies): Promise<{ sites: ListedSite[] }> {
  const sites = await deps.sites.listSites();
  const listed = await Promise.all(
    sites.map(async (site) => {
      try {
        const readiness = await getSiteReadiness(deps, site.id);
        const listedSite: ListedSite = {
          ...site,
          crewStatus: readiness.crewStatus,
          ...siteCounts(readiness.crewStatus, readiness.shortages.length, readiness.blockers.length),
        };
        return listedSite;
      } catch (error) {
        if (error instanceof UpstreamError) log("upstream_failed", { code: error.code, system: error.system });
        const unavailable: ListedSite = { ...site, crewStatus: "unavailable", shortageCount: 0, dataProblemCount: 0 };
        return unavailable;
      }
    }),
  );
  return { sites: listed };
}
