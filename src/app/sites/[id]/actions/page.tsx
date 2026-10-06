import { notFound, redirect } from "next/navigation";
import { IdSchema } from "@/ports";
import { ACTIONS_PATH, siteAnchor } from "@/ui/format";

export const dynamic = "force-dynamic";

/** The old per-site URL opens that site's section of the actions log. */
export default async function ActionsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) notFound();
  redirect(`${ACTIONS_PATH}#${siteAnchor(id)}`);
}
