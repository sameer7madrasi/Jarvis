import { NextResponse } from "next/server";
import { fetchDraftBySlug, updateDraft } from "@/lib/data-v2";
import type { DraftStatus } from "@/lib/types-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: { slug: string } },
) {
  const draft = await fetchDraftBySlug(ctx.params.slug);
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function PATCH(
  req: Request,
  ctx: { params: { slug: string } },
) {
  const body = (await req.json()) as Partial<{
    title: string;
    body_md: string;
    status: DraftStatus;
    tags: string[];
    target_symbols: string[];
  }>;
  try {
    const updated = await updateDraft(ctx.params.slug, body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "update failed" },
      { status: 400 },
    );
  }
}
