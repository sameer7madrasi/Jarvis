/**
 * POST /api/banks/sync
 *
 * Body: { itemId?: string }
 *  - itemId set     → sync just that institution (LinkedAccountsList "Sync now").
 *  - itemId absent  → sync every Plaid-backed linked_item (UI "Sync all" / chat tool).
 *
 * Returns the array of SyncReport so the UI can show "added 12, modified 3".
 */

import { NextResponse } from "next/server";

import { syncAll, syncItem } from "@/lib/banks/sync";
import { isPlaidConfigured } from "@/lib/banks/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  itemId?: string;
}

export async function POST(req: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured." },
      { status: 503 },
    );
  }

  let body: Body = {};
  try {
    body = (await req.json().catch(() => ({}))) as Body;
  } catch {
    /* ignore – treat as syncAll */
  }

  try {
    if (body.itemId) {
      const report = await syncItem(body.itemId);
      return NextResponse.json({ reports: [report] });
    }
    const reports = await syncAll();
    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    console.error("[banks/sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
