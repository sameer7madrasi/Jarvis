/**
 * Shared browser-side Plaid Link helpers (exchange + initial sync).
 * Used by `LinkBankButton` and `app/banks/return` (OAuth redirect completion).
 */

import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";

export async function fetchPlaidLinkToken(): Promise<string> {
  const res = await fetch("/api/banks/link-token", { method: "POST" });
  const data: { link_token?: string; error?: string } = await res.json();
  if (!res.ok) throw new Error(data.error ?? `link-token HTTP ${res.status}`);
  if (!data.link_token) throw new Error("missing link_token");
  return data.link_token;
}

/**
 * When Plaid redirects the browser here after an OAuth institution (e.g. BoA),
 * pass this full URL as `receivedRedirectUri` to `usePlaidLink` so Link can finish.
 */
export function getPlaidOAuthReceivedRedirectUri(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const href = window.location.href;
  return href.includes("oauth_state_id=") ? href : undefined;
}

export async function exchangePublicTokenAndInitialSync(
  publicToken: string,
  metadata: PlaidLinkOnSuccessMetadata,
): Promise<{ itemId: string }> {
  const exRes = await fetch("/api/banks/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ public_token: publicToken, metadata }),
  });
  const exData: { item_id?: string; error?: string } = await exRes
    .json()
    .catch(() => ({}));
  if (!exRes.ok) throw new Error(exData.error ?? `exchange HTTP ${exRes.status}`);
  if (!exData.item_id) throw new Error("missing item_id from exchange");

  // Kick off the initial sync without awaiting it. On Vercel Hobby the sync
  // route is hard-capped at ~10s and the initial Plaid backfill regularly
  // exceeds that; blocking the OAuth completion on it would leave the user
  // staring at a spinner. `keepalive: true` lets the request survive the
  // immediate `router.replace` navigation that happens after we return.
  // Plaid's TRANSACTIONS:INITIAL_UPDATE / HISTORICAL_UPDATE webhooks
  // (handled in app/api/banks/webhook/route.ts) will trigger syncItem again
  // within seconds, so transactions still land even if this fetch is killed.
  void fetch("/api/banks/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemId: exData.item_id }),
    keepalive: true,
  }).catch((err) => {
    console.warn("[plaidExchangeFlow] background sync kickoff failed:", err);
  });

  return { itemId: exData.item_id };
}
