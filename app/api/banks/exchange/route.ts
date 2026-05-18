/**
 * POST /api/banks/exchange
 *
 * Body: { public_token: string, metadata?: PlaidLinkOnSuccessMetadata }
 *
 * 1. Trades Plaid's short-lived `public_token` for a long-lived
 *    `access_token` via `/item/public_token/exchange`.
 * 2. Encrypts the access_token and persists a new `linked_items` row.
 * 3. Returns `{ item_id, institution_name }` so the client can immediately
 *    POST to /api/banks/sync for the initial transactions + holdings pull.
 *
 * Token storage notes — see lib/banks/encryption.ts. The plaintext token
 * never crosses the server boundary after this route returns.
 */

import { NextResponse } from "next/server";

import { createPlaidItem, findItemByProviderItemId } from "@/lib/banks/items";
import { getPlaidClient, isPlaidConfigured } from "@/lib/banks/plaid";
import { isEncryptionConfigured } from "@/lib/banks/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExchangeBody {
  public_token?: string;
  metadata?: {
    institution?: { name?: string; institution_id?: string };
  };
}

export async function POST(req: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured (PLAID_CLIENT_ID/PLAID_SECRET missing)." },
      { status: 503 },
    );
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          "JARVIS_ENCRYPTION_KEY is not set. Generate with: " +
          "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      },
      { status: 503 },
    );
  }

  let body: ExchangeBody;
  try {
    body = (await req.json()) as ExchangeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.public_token) {
    return NextResponse.json({ error: "public_token is required" }, { status: 400 });
  }

  const client = getPlaidClient()!;
  try {
    const exchange = await client.itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const { access_token, item_id } = exchange.data;

    // If the user re-links the same institution, Plaid returns the same
    // item_id. Treat that as success and avoid creating a duplicate row.
    const existing = await findItemByProviderItemId(item_id);
    if (existing) {
      // Helpful when chasing "I just linked but Connections is empty" — if
      // a stale row from local dev / another deploy is short-circuiting the
      // fresh link, this is what you'll see in Vercel logs.
      console.warn("[banks/exchange] already_linked short-circuit", {
        local_id: existing.id,
        provider_item_id: item_id,
        institution_name: existing.institution_name,
        status: existing.status,
        last_synced_at: existing.last_synced_at,
        last_error: existing.last_error,
      });
      return NextResponse.json({
        item_id: existing.id,
        institution_name: existing.institution_name,
        already_linked: true,
      });
    }

    const institutionName = body.metadata?.institution?.name ?? null;
    const institutionId = body.metadata?.institution?.institution_id ?? null;

    const row = await createPlaidItem({
      provider_item_id: item_id,
      institution_id: institutionId,
      institution_name: institutionName,
      access_token,
    });

    console.info("[banks/exchange] linked_items row created", {
      local_id: row.id,
      provider_item_id: item_id,
      institution_name: row.institution_name,
    });

    return NextResponse.json({
      item_id: row.id,
      institution_name: row.institution_name,
      already_linked: false,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Plaid /item/public_token/exchange failed";
    console.error("[banks/exchange]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
