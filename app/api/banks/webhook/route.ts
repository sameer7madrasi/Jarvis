/**
 * POST /api/banks/webhook
 *
 * Plaid → Jarvis webhook. Plaid pings this endpoint when it has new
 * transactions, updated holdings, or item-level errors.
 *
 * Verification (https://plaid.com/docs/api/webhooks/webhook-verification/):
 *   - Header `plaid-verification` carries a JWT signed with ES256.
 *   - Body's sha256 hash MUST equal the JWT's `request_body_sha256` claim.
 *   - The JWT's signing key (`kid`) is fetched from Plaid's
 *     `/webhook_verification_key/get` endpoint and cached briefly.
 *
 * We skip verification entirely when PLAID_CLIENT_ID is missing (dev with no
 * Plaid env) — the webhook just won't be reachable in that case.
 *
 * Dispatched on:
 *   - TRANSACTIONS:SYNC_UPDATES_AVAILABLE → run syncItem
 *   - HOLDINGS:DEFAULT_UPDATE             → run syncItem (re-pulls /holdings)
 *   - ITEM:ERROR                          → mark item status = error
 *   - ITEM:LOGIN_REQUIRED                 → mark item status = login_required
 */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";

import { findItemByProviderItemId, updateItem } from "@/lib/banks/items";
import { syncItem } from "@/lib/banks/sync";
import { getPlaidClient, isPlaidConfigured } from "@/lib/banks/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlaidWebhookBody {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: { error_code?: string; error_message?: string } | null;
  // ... many other shape-specific fields we don't need
}

const keyCache = new Map<string, { jwk: JWK; expires: number }>();

async function fetchVerificationKey(kid: string): Promise<JWK | null> {
  const cached = keyCache.get(kid);
  if (cached && cached.expires > Date.now()) return cached.jwk;
  const client = getPlaidClient();
  if (!client) return null;
  try {
    const res = await client.webhookVerificationKeyGet({ key_id: kid });
    const jwk = res.data.key as unknown as JWK;
    // Cache for 24h — Plaid rotates keys infrequently and signals expiry on the key.
    keyCache.set(kid, { jwk, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return jwk;
  } catch (err) {
    console.error("[banks/webhook] failed to fetch verification key", err);
    return null;
  }
}

async function verifyPlaidJwt(token: string, rawBody: string): Promise<boolean> {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "ES256" || !header.kid) return false;
    const jwk = await fetchVerificationKey(header.kid);
    if (!jwk) return false;
    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(token, key);
    const expected = createHash("sha256").update(rawBody).digest("hex");
    return payload.request_body_sha256 === expected;
  } catch (err) {
    console.error("[banks/webhook] JWT verify failed", err);
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const jwt = req.headers.get("plaid-verification");

  // Verification — skipped when Plaid isn't configured at all (helpful in
  // local dev before keys are set). Otherwise, an unverified webhook is a
  // hard reject.
  if (isPlaidConfigured()) {
    if (!jwt) {
      return NextResponse.json({ error: "missing plaid-verification header" }, { status: 401 });
    }
    const ok = await verifyPlaidJwt(jwt, rawBody);
    if (!ok) {
      return NextResponse.json({ error: "invalid webhook signature" }, { status: 401 });
    }
  }

  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(rawBody) as PlaidWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const item = await findItemByProviderItemId(body.item_id).catch(() => null);
  if (!item) {
    // Don't 500 — Plaid retries on non-2xx and we'd loop forever on stale items.
    console.warn("[banks/webhook] unknown item_id", body.item_id);
    return NextResponse.json({ ok: true, ignored: "unknown item_id" });
  }

  const key = `${body.webhook_type}:${body.webhook_code}`;
  try {
    switch (key) {
      case "TRANSACTIONS:SYNC_UPDATES_AVAILABLE":
      case "TRANSACTIONS:DEFAULT_UPDATE":
      case "TRANSACTIONS:INITIAL_UPDATE":
      case "TRANSACTIONS:HISTORICAL_UPDATE":
      case "HOLDINGS:DEFAULT_UPDATE":
      case "INVESTMENTS_TRANSACTIONS:DEFAULT_UPDATE":
        await syncItem(item.id);
        break;
      case "ITEM:ERROR":
        await updateItem(item.id, {
          status: "error",
          last_error: body.error?.error_message ?? body.error?.error_code ?? "unknown",
        });
        break;
      case "ITEM:LOGIN_REQUIRED":
      case "ITEM:USER_PERMISSION_REVOKED":
        await updateItem(item.id, { status: "login_required" });
        break;
      default:
        console.info("[banks/webhook] unhandled webhook", key);
    }
  } catch (err) {
    console.error("[banks/webhook] dispatch failed", err);
    // Acknowledge anyway — we've already logged the error to linked_items.
  }

  return NextResponse.json({ ok: true });
}
