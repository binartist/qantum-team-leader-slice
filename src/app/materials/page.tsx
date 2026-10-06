import Link from "next/link";
import { MenuBar } from "@/ui/AppBar";
import { Banner } from "@/ui/Banner";
import { Icon } from "@/ui/Icon";
import { KindIcon } from "@/ui/KindIcon";
import { StatusChip } from "@/ui/StatusChip";
import { StockFigures } from "@/ui/StockFigures";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { materialPagePath, materialStockLine, plannedAcrossLine } from "@/ui/format";
import { materialState, uncheckedBanner } from "@/ui/materials";
import { MATERIALS } from "@/ui/messages";
import styles from "@/ui/primitives.module.css";
import { getCachedMaterialList } from "../_lib/cached";
import { loadPage } from "../_lib/load";

export const dynamic = "force-dynamic";
export const metadata = { title: MATERIALS.title };

/** Every material a site plans to use, against the one shared stock (AC 38). */
export default async function MaterialsPage() {
  const loaded = await loadPage(() => getCachedMaterialList());
  if (loaded.status === "unavailable") {
    return (
      <>
        <MenuBar current="materials" />
        <main>
          <h1>{MATERIALS.title}</h1>
          <UnavailablePanel status={{ label: MATERIALS.unavailable, tone: "warning", icon: "warning" }} />
        </main>
      </>
    );
  }
  const list = loaded.value;
  return (
    <>
      <MenuBar current="materials" />
      <main>
        <h1>{MATERIALS.title}</h1>
        {list.stockAsOf === null ? null : <StockFigures notice={list.stockNotice} stockAsOf={list.stockAsOf} asOf={list.asOf} />}
        {list.uncheckedSiteCount > 0 ? (
          <Banner status={{ label: uncheckedBanner(list.uncheckedSiteCount), tone: "warning", icon: "warning" }} />
        ) : null}
        {list.materials.length === 0 ? (
          <p>{list.uncheckedSiteCount > 0 ? MATERIALS.emptyChecked : MATERIALS.empty}</p>
        ) : (
          <ul className={styles.list}>
            {list.materials.map((material) => {
              const state = materialState({ ...material, uncheckedSiteCount: list.uncheckedSiteCount });
              // With stock unknown the chip says so; the line keeps only the need, so it is not said twice.
              const figures =
                material.onHandQty === null
                  ? plannedAcrossLine(material.plannedQty, material.unit)
                  : materialStockLine(material.onHandQty, material.plannedQty, material.unit);
              return (
                <li key={material.id}>
                  <Link className={styles.penetrationLink} href={materialPagePath(material.id)}>
                    <span className={styles.penetrationLines}>
                      <span className={`${styles.materialName} ${styles.kindTitle}`}>
                        <KindIcon kind="material" />
                        {material.name}
                      </span>
                      {figures ? <span className={styles.muted}>{figures}</span> : null}
                      {state ? (
                        <span className={styles.factChips}>
                          <StatusChip status={state} />
                        </span>
                      ) : (
                        <span className={styles.muted}>{MATERIALS.notShortAnywhere}</span>
                      )}
                    </span>
                    <Icon name="chevron-right" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
