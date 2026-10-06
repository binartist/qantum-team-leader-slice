import { notFound, redirect } from "next/navigation";
import { IdSchema } from "@/ports";
import { sitePath } from "@/ui/format";

export const dynamic = "force-dynamic";

/** The actions log is the header panel. This URL opens it. */
export default async function ActionsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) notFound();
  redirect(`${sitePath(id)}?log=open`);
}
