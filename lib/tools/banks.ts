/**
 * JarvisHome bank-sync tools.
 *
 * `list_linked_accounts` is read-only.
 * `sync_bank_accounts` is a *write* tool — it hits Plaid and mutates the
 * transactions / holdings tables. The UI ToolCallChip already styles
 * any tool name matching `/^(sync|create|delete|update|add)_/` as a
 * "write" action, so naming matters here.
 */

import { tool } from "ai";
import { z } from "zod";

import { listItems, type LinkedItem } from "../banks/items";
import { syncAll, syncItem, type SyncReport } from "../banks/sync";
import { isPlaidConfigured } from "../banks/plaid";

function summarizeItem(it: LinkedItem) {
  return {
    id: it.id,
    institution: it.institution_name ?? "(unknown)",
    provider: it.provider,
    status: it.status,
    last_synced_at: it.last_synced_at,
    last_error: it.last_error,
  };
}

export const listLinkedAccounts = tool({
  description:
    "List every bank or brokerage Sameer has linked to Jarvis (via Plaid or CSV). Use this when he asks 'what's connected?', 'is BofA syncing?', or before suggesting a manual sync.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const items = await listItems();
      return {
        ok: true as const,
        count: items.length,
        items: items.map(summarizeItem),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list linked items";
      return {
        ok: false as const,
        error: message,
        hint: "Supabase may not be configured. Confirm NEXT_PUBLIC_SUPABASE_* env vars are set.",
        items: [],
      };
    }
  },
});

export const syncBankAccounts = tool({
  description:
    "Trigger a Plaid sync for one or all linked institutions and pull new transactions + holdings into Jarvis. Use this when Sameer asks 'pull my latest transactions', 'refresh my BofA data', or after he says he just made a purchase he expects to see.",
  parameters: z.object({
    institution: z
      .string()
      .optional()
      .describe(
        "Optional institution name (case-insensitive substring). Leave empty to sync every linked institution.",
      ),
  }),
  execute: async ({ institution }) => {
    if (!isPlaidConfigured()) {
      return {
        ok: false as const,
        error: "Plaid is not configured.",
        hint: "Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV in .env.local and restart the dev server.",
      };
    }

    try {
      let reports: SyncReport[];
      if (institution) {
        const items = await listItems();
        const needle = institution.toLowerCase();
        const matches = items.filter(
          (it) =>
            it.provider === "plaid" &&
            (it.institution_name ?? "").toLowerCase().includes(needle),
        );
        if (matches.length === 0) {
          return {
            ok: false as const,
            error: `no linked Plaid item matches "${institution}"`,
            hint: "Call list_linked_accounts first to see what's connected.",
          };
        }
        reports = [];
        for (const it of matches) {
          reports.push(await syncItem(it.id));
        }
      } else {
        reports = await syncAll();
      }

      const totals = reports.reduce(
        (acc, r) => {
          acc.added += r.txAdded;
          acc.modified += r.txModified;
          acc.removed += r.txRemoved;
          acc.holdings += r.holdingsUpserted;
          if (r.error) acc.errors.push(`${r.institution ?? r.itemId}: ${r.error}`);
          return acc;
        },
        { added: 0, modified: 0, removed: 0, holdings: 0, errors: [] as string[] },
      );

      return {
        ok: totals.errors.length === 0,
        synced_items: reports.length,
        transactions_added: totals.added,
        transactions_modified: totals.modified,
        transactions_removed: totals.removed,
        holdings_upserted: totals.holdings,
        errors: totals.errors,
        per_institution: reports.map((r) => ({
          institution: r.institution,
          tx_added: r.txAdded,
          tx_modified: r.txModified,
          holdings: r.holdingsUpserted,
          error: r.error ?? null,
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "sync failed";
      return {
        ok: false as const,
        error: message,
        hint: "Check the dev server logs for the underlying Plaid error.",
      };
    }
  },
});

export const BANK_TOOLS = {
  list_linked_accounts: listLinkedAccounts,
  sync_bank_accounts: syncBankAccounts,
} as const;
