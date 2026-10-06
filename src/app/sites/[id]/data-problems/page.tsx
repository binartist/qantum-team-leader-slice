import { notFound, redirect } from "next/navigation";
import { IdSchema } from "@/ports";
import { sitePath } from "@/ui/format";

export const dynamic = "force-dynamic";

/** Data problems are a filter on the site list. */
export default async function DataProblemsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) notFound();
  redirect(`${sitePath(id)}?show=data-problems`);
}
