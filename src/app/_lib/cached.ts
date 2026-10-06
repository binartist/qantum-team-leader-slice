import { cache } from "react";
import { describePenetration, listActions, listCandidates, loadSiteData } from "@/application";
import { getDependencies } from "@/server/deps";

export const getCachedSite = cache(async (siteId: string) => getDependencies().sites.getSite(siteId));

/** Readiness plus every planned penetration, loaded once per request. */
export const getCachedSiteData = cache(async (siteId: string) => loadSiteData(getDependencies(), siteId));

export const getCachedReadiness = cache(async (siteId: string) => (await getCachedSiteData(siteId)).readiness);

export const getCachedActions = cache(async (siteId: string) => listActions(getDependencies(), siteId));

export const getCachedCandidates = cache(async (siteId: string, penetrationId: string) =>
  listCandidates(getDependencies(), siteId, penetrationId),
);

export const getCachedPenetrationDetail = cache(async (siteId: string, penetrationId: string) =>
  describePenetration(getDependencies(), siteId, penetrationId),
);
