import { redirect } from "next/navigation";
import { sitePath } from "@/ui/format";

export const dynamic = "force-dynamic";

/** Data problems are a filter on the site list. */
export default async function DataProblemsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`${sitePath(id)}?show=data-problems`);
}
