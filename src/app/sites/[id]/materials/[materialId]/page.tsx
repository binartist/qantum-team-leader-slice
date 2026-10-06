import { notFound, redirect } from "next/navigation";
import { IdSchema } from "@/ports";
import { materialPagePath } from "@/ui/format";

export const dynamic = "force-dynamic";

/** One material's page is across sites now (AC 41). This URL opens it at the site's own section. */
export default async function SiteMaterialRedirect({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  if (!IdSchema.safeParse(id).success || !IdSchema.safeParse(materialId).success) notFound();
  redirect(materialPagePath(materialId, { siteId: id }));
}
