/**
 * Plaid SDK client + lightweight env detection.
 *
 * The Plaid Node SDK is server-only. Every file that imports this must run
 * under Node (route handlers, `lib/banks/sync.ts`, etc.) — never client
 * components.
 *
 * Env:
 *   PLAID_CLIENT_ID  — from https://dashboard.plaid.com/team/keys
 *   PLAID_SECRET     — the secret matching PLAID_ENV (Sandbox / Production)
 *   PLAID_ENV        — 'sandbox' (default) | 'production'
 *                      (Plaid's old 'development' env was retired in 2024)
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

export type PlaidEnv = "sandbox" | "production";

let cached: PlaidApi | null = null;

export function getPlaidEnv(): PlaidEnv {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

/**
 * Plaid **Production** requires `redirect_uri` to be HTTPS. Sandbox allows
 * `http://localhost` for local testing. Returns a user-facing error string, or
 * `null` if OK / not applicable.
 */
export function productionRedirectUriError(): string | null {
  if (getPlaidEnv() !== "production") return null;
  const uri = process.env.PLAID_REDIRECT_URI?.trim();
  if (!uri) return null;
  if (uri.startsWith("https://")) return null;
  return (
    "Plaid Production requires PLAID_REDIRECT_URI to use HTTPS (e.g. https://YOUR-SUBDOMAIN.ngrok-free.app/banks/return). " +
    "http://localhost is rejected with INVALID_FIELD. Use ngrok (or deploy to Vercel) and register the exact URL in the Plaid dashboard under Allowed redirect URIs."
  );
}

/**
 * Returns a singleton PlaidApi client, or `null` when env vars are missing.
 * Callers should check first and surface a friendly error in the UI/chat,
 * mirroring the AI/Supabase mock-fallback pattern.
 */
export function getPlaidClient(): PlaidApi | null {
  if (!isPlaidConfigured()) return null;
  if (cached) return cached;

  const env = getPlaidEnv();
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
        "Plaid-Version": "2020-09-14",
      },
    },
  });
  cached = new PlaidApi(config);
  return cached;
}

/**
 * Products + country codes used when creating link tokens. Centralised here
 * so the link-token route and any future re-link flows stay in sync.
 *
 * `transactions` powers the Money dashboard.
 * `investments` pulls brokerage holdings.
 *
 * We intentionally omit `Products.Auth`: Jarvis never calls `/auth/get` (ACH
 * numbers). Account last-4 masks come from `/accounts/get` alone. Skipping
 * Auth narrows the Plaid consent screen (read-only posture).
 */
export const DEFAULT_PRODUCTS: Products[] = [
  Products.Transactions,
  Products.Investments,
];

export const COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

/** Stable per-user identifier passed to Plaid. Single-user Jarvis = constant. */
export const JARVIS_USER_ID = "jarvis-single-user";

export { Products, CountryCode };
