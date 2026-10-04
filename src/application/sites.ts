import type { CrewStatus } from "@/domain";
import { UpstreamError, type Site } from "@/ports";
import { log } from "./log";
import { getSiteReadiness } from "./readiness";
import type { Dependencies } from "./types";

export interface ListedSite extends Site {
  readonly crewStatus: CrewStatus | "unavailable";
}

export async function listSites(deps: Dependencies): Promise<{ sites: ListedSite[] }> {
  const sites = await deps.sites.listSites();
  const listed = await Promise.all(
    sites.map(async (site) => {
      try {
        const readiness = await getSiteReadiness(deps, site.id);
        const listedSite: ListedSite = { ...site, crewStatus: readiness.crewStatus };
        return listedSite;
      } catch (error) {
        if (error instanceof UpstreamError) log("upstream_failed", { code: error.code, system: error.system });
        const unavailable: ListedSite = { ...site, crewStatus: "unavailable" };
        return unavailable;
      }
    }),
  );
  return { sites: listed };
}
