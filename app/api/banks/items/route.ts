/**
 * GET /api/banks/items
 *
 * List every linked institution (Plaid + CSV) for the LinkedAccountsList UI.
 * Never returns access tokens — only the public-ish metadata.
 */

import { NextResponse } from "next/server";
import { listItems } from "@/lib/banks/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listItems();
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list linked items";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
