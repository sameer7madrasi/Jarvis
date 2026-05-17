/**
 * Plaid sync engine — pulls accounts, transactions, and investment holdings
 * for a single linked_item and upserts them into Jarvis tables.
 *
 * Design notes:
 *  - Transactions use Plaid `/transactions/sync` (cursor-based incremental).
 *    We store the cursor on `linked_items.transactions_cursor` so the next
 *    run only ships deltas. Initial run starts with cursor = null/undefined.
 *  - Investments use `/investments/holdings/get` (full-snapshot). We replace
 *    every holding tied to this institution by upserting on `external_id`
 *    and deleting any prior holdings with the institution prefix that
 *    weren't seen this run.
 *  - Accounts are discovered from both endpoints and upserted by
 *    `provider_account_id` so existing rows keep their UUID + history.
 *  - All errors are caught + surfaced via `linked_items.last_error` so the
 *    UI can show "needs reauth" without losing data. ITEM_LOGIN_REQUIRED
 *    flips `status` to `login_required`.
 */

import {
  CountryCode,
  type AccountBase,
  type AccountSubtype,
  type AccountType as PlaidAccountType,
  type Holding,
  type Security,
  type Transaction as PlaidTransaction,
  type TransactionsSyncRequest,
} from "plaid";

import { getSupabase } from "../supabase";
import type { AccountType } from "../types";
import { mapPlaidCategory } from "./categories";
import { getItemWithToken, updateItem, type LinkedItem } from "./items";
import { getPlaidClient, isPlaidConfigured } from "./plaid";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SyncReport {
  itemId: string;
  institution: string | null;
  accountsUpserted: number;
  txAdded: number;
  txModified: number;
  txRemoved: number;
  holdingsUpserted: number;
  error?: string;
}

export async function syncItem(itemId: string): Promise<SyncReport> {
  const item = await getItemWithToken(itemId);
  if (!item) throw new Error(`linked_items row ${itemId} not found`);
  if (item.provider !== "plaid") {
    return {
      itemId,
      institution: item.institution_name,
      accountsUpserted: 0,
      txAdded: 0,
      txModified: 0,
      txRemoved: 0,
      holdingsUpserted: 0,
      error: `cannot sync provider=${item.provider}`,
    };
  }
  if (!isPlaidConfigured()) {
    throw new Error("Plaid env vars are not configured");
  }

  const report: SyncReport = {
    itemId,
    institution: item.institution_name,
    accountsUpserted: 0,
    txAdded: 0,
    txModified: 0,
    txRemoved: 0,
    holdingsUpserted: 0,
  };

  try {
    const accountMap = await syncAccounts(item);
    report.accountsUpserted = accountMap.size;

    const txReport = await syncTransactions(item, accountMap);
    report.txAdded = txReport.added;
    report.txModified = txReport.modified;
    report.txRemoved = txReport.removed;

    const holdReport = await syncHoldings(item, accountMap);
    report.holdingsUpserted = holdReport.upserted;

    await updateItem(item.id, {
      status: "active",
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.error = message;
    const isReauth =
      /ITEM_LOGIN_REQUIRED/i.test(message) || /INVALID_ACCESS_TOKEN/i.test(message);
    await updateItem(item.id, {
      status: isReauth ? "login_required" : "error",
      last_error: message.slice(0, 500),
    }).catch((e) => console.error("[syncItem] failed to persist error:", e));
    console.error("[syncItem]", err);
  }
  return report;
}

export async function syncAll(): Promise<SyncReport[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const { data, error } = await sb
    .from("linked_items")
    .select("id")
    .eq("provider", "plaid");
  if (error) throw new Error(error.message);
  const reports: SyncReport[] = [];
  for (const row of data ?? []) {
    reports.push(await syncItem(row.id as string));
  }
  return reports;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/** Returns a map of Plaid account_id → local accounts.id UUID. */
async function syncAccounts(item: LinkedItem & { access_token: string }): Promise<Map<string, string>> {
  const client = getPlaidClient()!;
  const sb = getSupabase()!;

  const res = await client.accountsGet({ access_token: item.access_token });
  const plaidAccounts = res.data.accounts;
  let institutionName = item.institution_name;

  // Resolve institution name via /institutions/get_by_id on first sync if
  // the Link metadata didn't include one (rare but possible for re-auth flows).
  if (!institutionName && res.data.item.institution_id) {
    try {
      const inst = await client.institutionsGetById({
        institution_id: res.data.item.institution_id,
        country_codes: [CountryCode.Us],
      });
      institutionName = inst.data.institution.name;
      await sb
        .from("linked_items")
        .update({ institution_name: institutionName })
        .eq("id", item.id);
    } catch (err) {
      console.warn("[syncAccounts] could not resolve institution name", err);
    }
  }

  const map = new Map<string, string>();
  for (const acct of plaidAccounts) {
    const id = await upsertAccount(item, acct, institutionName);
    map.set(acct.account_id, id);
  }
  return map;
}

async function upsertAccount(
  item: LinkedItem,
  plaidAccount: AccountBase,
  institutionName: string | null,
): Promise<string> {
  const sb = getSupabase()!;
  const accountType = mapAccountType(plaidAccount.type, plaidAccount.subtype);
  const name = plaidAccount.name ?? plaidAccount.official_name ?? `Account ${plaidAccount.mask ?? ""}`;

  const { data: existing, error: selErr } = await sb
    .from("accounts")
    .select("id")
    .eq("provider_account_id", plaidAccount.account_id)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existing) {
    await sb
      .from("accounts")
      .update({
        name,
        type: accountType,
        mask: plaidAccount.mask ?? null,
        institution_name: institutionName,
        linked_item_id: item.id,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data, error } = await sb
    .from("accounts")
    .insert({
      name,
      type: accountType,
      mask: plaidAccount.mask ?? null,
      institution_name: institutionName,
      linked_item_id: item.id,
      provider_account_id: plaidAccount.account_id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

function mapAccountType(
  type: PlaidAccountType,
  subtype: AccountSubtype | null | undefined,
): AccountType {
  switch (type) {
    case "depository":
      if (subtype === "savings" || subtype === "money market" || subtype === "cd") return "savings";
      return "checking";
    case "credit":
      return "credit";
    case "loan":
      return "credit";
    case "investment":
      if (subtype === "ira" || subtype === "roth" || subtype === "401k" || subtype === "403B" || subtype === "457b") {
        return "retirement";
      }
      return "brokerage";
    default:
      return "cash";
  }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

interface TxSyncReport {
  added: number;
  modified: number;
  removed: number;
}

async function syncTransactions(
  item: LinkedItem & { access_token: string },
  accountMap: Map<string, string>,
): Promise<TxSyncReport> {
  const client = getPlaidClient()!;
  const sb = getSupabase()!;

  let cursor: string | undefined = item.transactions_cursor ?? undefined;
  const report: TxSyncReport = { added: 0, modified: 0, removed: 0 };
  let hasMore = true;

  while (hasMore) {
    const req: TransactionsSyncRequest = {
      access_token: item.access_token,
      cursor,
      count: 500,
    };
    const res = await client.transactionsSync(req);
    const { added, modified, removed, next_cursor, has_more } = res.data;

    for (const tx of added) {
      const row = toJarvisTransaction(tx, accountMap);
      if (!row) continue;
      const { error } = await sb
        .from("transactions")
        .upsert(row, { onConflict: "external_id", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
      report.added += 1;
    }

    for (const tx of modified) {
      const row = toJarvisTransaction(tx, accountMap);
      if (!row) continue;
      const { error } = await sb
        .from("transactions")
        .upsert(row, { onConflict: "external_id", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
      report.modified += 1;
    }

    if (removed.length > 0) {
      const ids = removed.map((r) => `plaid:${r.transaction_id}`);
      const { error } = await sb.from("transactions").delete().in("external_id", ids);
      if (error) throw new Error(error.message);
      report.removed += removed.length;
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  if (cursor !== undefined) {
    await updateItem(item.id, { transactions_cursor: cursor });
  }
  return report;
}

interface JarvisTxRow {
  date: string;
  merchant: string;
  amount: number;
  type: "income" | "expense" | "investment";
  category: string;
  account_id: string | null;
  notes: string | null;
  external_id: string;
}

function toJarvisTransaction(
  tx: PlaidTransaction,
  accountMap: Map<string, string>,
): JarvisTxRow | null {
  const accountId = accountMap.get(tx.account_id) ?? null;
  // Skip pending: they churn and Plaid will resend as posted.
  if (tx.pending) return null;

  const pfc = tx.personal_finance_category;
  const mapped = mapPlaidCategory(pfc?.primary, pfc?.detailed);

  const merchant =
    tx.merchant_name?.trim() || tx.name?.trim() || "(unknown merchant)";

  return {
    date: tx.date,
    merchant: merchant.slice(0, 200),
    amount: Math.abs(tx.amount ?? 0),
    type: mapped.kind,
    category: mapped.category,
    account_id: accountId,
    notes:
      tx.merchant_name && tx.name && tx.merchant_name !== tx.name
        ? `Plaid: ${tx.name}`
        : null,
    external_id: `plaid:${tx.transaction_id}`,
  };
}

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

interface HoldingsSyncReport {
  upserted: number;
}

async function syncHoldings(
  item: LinkedItem & { access_token: string },
  accountMap: Map<string, string>,
): Promise<HoldingsSyncReport> {
  const client = getPlaidClient()!;
  const sb = getSupabase()!;

  // Skip institutions without Investments — Plaid returns
  // PRODUCT_NOT_READY / NO_INVESTMENT_ACCOUNTS for those. Treat as no-op.
  let plaidHoldings: Holding[] = [];
  let securities: Security[] = [];
  try {
    const res = await client.investmentsHoldingsGet({ access_token: item.access_token });
    plaidHoldings = res.data.holdings;
    securities = res.data.securities;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/NO_INVESTMENT_ACCOUNTS|PRODUCT_NOT_READY|INVALID_PRODUCT/i.test(message)) {
      return { upserted: 0 };
    }
    throw err;
  }

  const securityById = new Map(securities.map((s) => [s.security_id, s]));
  const seenExternalIds: string[] = [];
  let upserted = 0;

  for (const h of plaidHoldings) {
    const accountId = accountMap.get(h.account_id);
    if (!accountId) continue;
    const sec = securityById.get(h.security_id);
    if (!sec) continue;
    const symbol = (sec.ticker_symbol ?? sec.name ?? "UNKNOWN").toUpperCase().slice(0, 24);
    const externalId = `plaid:${item.id}:${h.account_id}:${h.security_id}`;
    seenExternalIds.push(externalId);

    const costBasis = h.cost_basis ?? (h.institution_price ?? 0) * (h.quantity ?? 0);
    const row = {
      symbol,
      qty: h.quantity ?? 0,
      cost_basis: costBasis,
      account_id: accountId,
      external_id: externalId,
    };

    const { error } = await sb
      .from("holdings")
      .upsert(row, { onConflict: "external_id", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    upserted += 1;
  }

  // Delete holdings that were previously synced from this item but no
  // longer appear (closed positions). Scope by `external_id LIKE 'plaid:<itemId>:%'`
  // so manual holdings (external_id IS NULL) are never touched.
  const prefix = `plaid:${item.id}:`;
  const { data: stale, error: staleErr } = await sb
    .from("holdings")
    .select("id, external_id")
    .like("external_id", `${prefix}%`);
  if (staleErr) throw new Error(staleErr.message);
  const staleIds = (stale ?? [])
    .filter((row) => !seenExternalIds.includes(row.external_id as string))
    .map((row) => row.id as string);
  if (staleIds.length > 0) {
    await sb.from("holdings").delete().in("id", staleIds);
  }
  return { upserted };
}

export { CountryCode };
