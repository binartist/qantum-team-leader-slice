import { redirect } from "next/navigation";
import { sitePath } from "@/ui/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ material?: string | string[] }>;
};

/** The list now lives on the site screen. Old links keep their material filter. */
export default async function PenetrationsRedirect({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { material } = await searchParams;
  const values = material === undefined ? [] : Array.isArray(material) ? material : [material];
  const query = values.map((value) => `material=${encodeURIComponent(value)}`).join("&");
  redirect(query.length === 0 ? sitePath(id) : `${sitePath(id)}?${query}`);
}
