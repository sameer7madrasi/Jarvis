/**
 * POST /api/banks/csv
 *
 * Multipart upload of a bank-exported CSV. The request must include:
 *   - `file`      : the CSV blob
 *   - `accountId` : UUID of the local accounts row to attribute rows to
 *
 * Returns `{ summary: { imported, duplicates, errors }, parsed: { rows, skipped } }`.
 *
 * On first CSV import we also create a `linked_items` row with provider='csv'
 * so the LinkedAccountsList shows where the data came from.
 */

import { NextResponse } from "next/server";

import { getSupabase } from "@/lib/supabase";
import { importCsv, parseCsv } from "@/lib/banks/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const accountId = form.get("accountId");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseCsv(text);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "no rows could be parsed from CSV", parsed },
      { status: 400 },
    );
  }

  try {
    const summary = await importCsv(parsed.rows, { accountId });

    // Record a thin linked_items row so the user can see where it came from.
    // No access token — just provenance.
    await sb.from("linked_items").upsert(
      {
        provider: "csv",
        provider_item_id: `csv:${accountId}`,
        institution_name: "CSV import",
        status: "active",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "provider_item_id" },
    );

    return NextResponse.json({ summary, parsed: { skipped: parsed.skipped, total: parsed.rows.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "csv import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
