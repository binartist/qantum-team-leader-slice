import { getCachedActions } from "../../_lib/cached";
import { loadPage } from "../../_lib/load";
import { ActionsDrawer } from "@/ui/ActionsDrawer";
import { UnavailablePanel } from "@/ui/UnavailablePanel";
import { readinessBanner } from "@/ui/messages";
import { ActionsLog } from "./actions-log";

/** The header's actions control for one site. A failed read shows no count and says so inside the panel. */
export async function SiteActionsButton({ siteId, initialOpen }: { siteId: string; initialOpen: boolean }) {
  const loaded = await loadPage(() => getCachedActions(siteId));
  if (loaded.status === "unavailable") {
    return (
      <ActionsDrawer count={null} initialOpen={initialOpen}>
        <UnavailablePanel status={readinessBanner("unavailable")} />
      </ActionsDrawer>
    );
  }
  const listed = loaded.value;
  return (
    <ActionsDrawer count={listed.actions.length + listed.proposals.length} initialOpen={initialOpen}>
      <ActionsLog siteId={siteId} listed={listed} />
    </ActionsDrawer>
  );
}
