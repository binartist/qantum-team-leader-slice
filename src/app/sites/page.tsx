import { listSites } from "@/application";
import { getDependencies } from "@/server/deps";
import { AppBar } from "@/ui/AppBar";
import { EMPTY, SITES_UNAVAILABLE } from "@/ui/messages";
import { SiteCard } from "@/ui/SiteCard";
import { siteChip } from "@/ui/status";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "../_lib/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites" };

export default async function SitesPage() {
  const loaded = await loadPage(() => listSites(getDependencies()));
  return (
    <>
      <AppBar title="Sites" />
      <main>
        {loaded.status === "unavailable" ? (
          <UnavailablePanel status={{ label: SITES_UNAVAILABLE, tone: "warning", icon: "warning" }} />
        ) : loaded.value.sites.length === 0 ? (
          <p>{EMPTY.sites}</p>
        ) : (
          <ul className={styles.list}>
            {loaded.value.sites.map((site) => (
              <li key={site.id}>
                <SiteCard
                  id={site.id}
                  name={site.name}
                  status={siteChip(site.crewStatus, site.shortageCount, site.dataProblemCount)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
