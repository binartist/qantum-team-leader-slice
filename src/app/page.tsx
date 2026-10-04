import { listSites } from "@/application";
import { getDependencies } from "@/server/deps";
import { Banner } from "@/ui/Banner";
import { EMPTY, SITES_UNAVAILABLE } from "@/ui/messages";
import { SiteCard } from "@/ui/SiteCard";
import { crewStatus } from "@/ui/status";
import styles from "@/ui/primitives.module.css";
import { loadPage } from "./_lib/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites" };

export default async function HomePage() {
  const loaded = await loadPage(() => listSites(getDependencies()));
  return (
    <main>
      <h1>Sites</h1>
      {loaded.status === "unavailable" ? (
        <Banner status={{ label: SITES_UNAVAILABLE, tone: "warning", icon: "warning" }} />
      ) : loaded.value.sites.length === 0 ? (
        <p>{EMPTY.sites}</p>
      ) : (
        <ul className={styles.list}>
          {loaded.value.sites.map((site) => (
            <li key={site.id}>
              <SiteCard id={site.id} name={site.name} reference={site.reference} status={crewStatus(site.crewStatus)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
