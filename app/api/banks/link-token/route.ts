/**
 * POST /api/banks/link-token
 *
 * Creates a short-lived (~30 min) Plaid Link token that the browser-side
 * react-plaid-link SDK uses to render the institution picker / OAuth flow.
 *
 * Link is created with **transactions** and **investments** products only
 * (`DEFAULT_PRODUCTS` in `lib/banks/plaid.ts`) — no Payment Initiation,
 * Transfer, Signal, or Plaid Auth (ACH numbers).
 *
 * Returns 503 if Plaid env vars aren't set so the UI can render a "Connect
 * Plaid to get started" hint instead of crashing.
 */

import { NextResponse } from "next/server";

import {
  COUNTRY_CODES,
  DEFAULT_PRODUCTS,
  JARVIS_USER_ID,
  getPlaidClient,
  getPlaidEnv,
  isPlaidConfigured,
  productionRedirectUriError,
} from "@/lib/banks/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      {
        error:
          "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local and restart.",
      },
      { status: 503 },
    );
  }

  const redirectErr = productionRedirectUriError();
  if (redirectErr) {
    return NextResponse.json({ error: redirectErr }, { status: 400 });
  }

  const client = getPlaidClient()!;
  try {
    const res = await client.linkTokenCreate({
      user: { client_user_id: JARVIS_USER_ID },
      client_name: "Jarvis",
      products: DEFAULT_PRODUCTS,
      country_codes: COUNTRY_CODES,
      language: "en",
      // BoA forces OAuth — Plaid requires a registered redirect URI here.
      // We accept it optional so Sandbox flows (which don't need OAuth) keep
      // working without configuration.
      redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
      webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    });
    return NextResponse.json({
      link_token: res.data.link_token,
      expiration: res.data.expiration,
      env: getPlaidEnv(),
    });
  } catch (err) {
    let message =
      err instanceof Error ? err.message : "Plaid /link/token/create failed";
    const ax = err as { response?: { data?: { error_message?: string; error_code?: string } } };
    const data = ax.response?.data;
    if (data?.error_message) {
      message = `${data.error_message}${data.error_code ? ` [${data.error_code}]` : ""}`;
    }
    console.error("[banks/link-token]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
