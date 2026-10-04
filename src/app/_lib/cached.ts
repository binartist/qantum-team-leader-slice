import { cache } from "react";
import { getSiteReadiness, listCandidates } from "@/application";
import { getDependencies } from "@/server/deps";

export const getCachedSite = cache(async (siteId: string) => getDependencies().sites.getSite(siteId));

export const getCachedReadiness = cache(async (siteId: string) => getSiteReadiness(getDependencies(), siteId));

export const getCachedCandidates = cache(async (siteId: string, penetrationId: string) =>
  listCandidates(getDependencies(), siteId, penetrationId),
);
