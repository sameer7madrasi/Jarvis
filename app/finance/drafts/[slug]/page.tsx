import { notFound } from "next/navigation";
import { fetchDraftBySlug } from "@/lib/data-v2";
import { DraftEditor } from "@/components/finance/DraftEditor";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }: { params: { slug: string } }) {
  const draft = await fetchDraftBySlug(params.slug).catch(() => null);
  if (!draft) notFound();
  return <DraftEditor draft={draft} />;
}
