import { redirect } from "next/navigation";
import { sitePath } from "@/ui/format";

export const dynamic = "force-dynamic";

/** The actions log is the header panel. This URL opens it. */
export default async function ActionsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`${sitePath(id)}?log=open`);
}
