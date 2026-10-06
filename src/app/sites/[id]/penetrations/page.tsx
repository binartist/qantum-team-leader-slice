import { notFound, redirect } from "next/navigation";
import { IdSchema } from "@/ports";
import { sitePath } from "@/ui/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ material?: string | string[] }>;
};

/** The list now lives on the site screen. Old links keep their material filter. */
export default async function PenetrationsRedirect({ params, searchParams }: PageProps) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) notFound();
  const { material } = await searchParams;
  // Only well-formed ids pass on, and at most two: a repeated filter only has to stay visibly repeated.
  const raw = material === undefined ? [] : Array.isArray(material) ? material : [material];
  const values = raw.filter((value) => IdSchema.safeParse(value).success).slice(0, 2);
  const query = values.map((value) => `material=${encodeURIComponent(value)}`).join("&");
  redirect(query.length === 0 ? sitePath(id) : `${sitePath(id)}?${query}`);
}
