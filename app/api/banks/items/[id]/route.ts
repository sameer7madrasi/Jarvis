/**
 * DELETE /api/banks/items/[id]
 *
 * Disconnects a linked institution:
 *   1. Tells Plaid to invalidate the access_token (`/item/remove`).
 *   2. Deletes the linked_items row. The ON DELETE SET NULL FK on
 *      accounts.linked_item_id keeps existing accounts and their historical
 *      transactions intact — we just stop syncing new data.
 *
 * Failure to reach Plaid is non-fatal — we still remove the local row so
 * the user can re-link without a stuck "ghost" entry.
 */

import { NextResponse } from "next/server";
import { deleteItem, getItemWithToken } from "@/lib/banks/items";
import { getPlaidClient, isPlaidConfigured } from "@/lib/banks/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const id = ctx.params.id;
  try {
    const item = await getItemWithToken(id).catch(() => null);
    if (item && item.provider === "plaid" && isPlaidConfigured()) {
      try {
        await getPlaidClient()!.itemRemove({ access_token: item.access_token });
      } catch (err) {
        console.warn("[banks/items DELETE] Plaid /item/remove failed:", err);
      }
    }
    await deleteItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to delete linked item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
