/**
 * JarvisHome tools — read-only views over the existing transactions data
 * (lib/data.ts) and analytics primitives (lib/analytics.ts).
 *
 * Each export is a Vercel AI SDK `tool()` definition with a zod schema for
 * inputs and a server-side `execute` implementation.
 */

import { tool } from "ai";
import { z } from "zod";

import { fetchAccounts, fetchTransactions } from "../data";
import {
  currentMonthKey,
  estimateNetWorth,
  monthlySeries,
  monthlyTotals,
  spendingByCategory,
} from "../analytics";

const MILLION_BY_30_TARGET = 1_000_000;

/** Validate "yyyy-mm-01" or "yyyy-mm" inputs; coerce to first-of-month iso. */
function normalizeMonth(input: string | undefined): string {
  if (!input) return currentMonthKey();
  const match = input.match(/^(\d{4})-(\d{2})/);
  if (!match) return currentMonthKey();
  return `${match[1]}-${match[2]}-01`;
}

export const listTransactions = tool({
  description:
    "List recent transactions, optionally filtered by type, category, or month. Returns up to `limit` rows ordered by date desc. Use this when the user asks 'what did I spend on…' or 'show me my income last month'.",
  parameters: z.object({
    month: z
      .string()
      .optional()
      .describe(
        "Optional yyyy-mm or yyyy-mm-01 string. Omit for all months.",
      ),
    type: z
      .enum(["income", "expense", "investment"])
      .optional()
      .describe("Filter by transaction type."),
    category: z
      .string()
      .optional()
      .describe("Filter by category name (e.g. 'Rent', 'Groceries')."),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }),
  execute: async ({ month, type, category, limit = 20 }) => {
    const all = await fetchTransactions();
    const monthIso = month ? normalizeMonth(month) : null;
    const filtered = all.filter((t) => {
      if (type && t.type !== type) return false;
      if (category && t.category.toLowerCase() !== category.toLowerCase()) return false;
      if (monthIso && t.date.slice(0, 7) !== monthIso.slice(0, 7)) return false;
      return true;
    });
    return {
      total_matching: filtered.length,
      shown: Math.min(filtered.length, limit),
      transactions: filtered.slice(0, limit).map((t) => ({
        date: t.date,
        merchant: t.merchant,
        amount: Number(t.amount),
        type: t.type,
        category: t.category,
        notes: t.notes ?? null,
      })),
    };
  },
});

export const monthlySummary = tool({
  description:
    "Return total income, expenses, invested, net cash flow and savings rate for a given month. Defaults to the current month.",
  parameters: z.object({
    month: z
      .string()
      .optional()
      .describe("Optional yyyy-mm or yyyy-mm-01 string. Defaults to current month."),
  }),
  execute: async ({ month }) => {
    const all = await fetchTransactions();
    const monthIso = normalizeMonth(month);
    const totals = monthlyTotals(all, monthIso);
    return {
      month: monthIso,
      income: round(totals.income),
      expenses: round(totals.expenses),
      invested: round(totals.invested),
      net_cash_flow: round(totals.netCashFlow),
      savings_rate: Math.round(totals.savingsRate * 1000) / 1000,
      summary: oneLineSummary(totals),
    };
  },
});

export const topCategories = tool({
  description:
    "Return the top N expense categories for a given month, ordered by total spent.",
  parameters: z.object({
    month: z
      .string()
      .optional()
      .describe("Optional yyyy-mm or yyyy-mm-01 string. Defaults to current month."),
    n: z.number().int().min(1).max(20).optional().default(5),
  }),
  execute: async ({ month, n = 5 }) => {
    const all = await fetchTransactions();
    const monthIso = normalizeMonth(month);
    const slices = spendingByCategory(all, monthIso).slice(0, n);
    const total = slices.reduce((acc, s) => acc + s.amount, 0);
    return {
      month: monthIso,
      total_expenses: round(total),
      categories: slices.map((s) => ({
        category: s.category,
        amount: round(s.amount),
        share: total > 0 ? Math.round((s.amount / total) * 1000) / 1000 : 0,
      })),
    };
  },
});

export const goalProgress = tool({
  description:
    "Return Sameer's progress toward the 'A Million by 30' net-worth goal using the V1 estimate, plus invested amounts for the last 6 months. Use this whenever he asks about goals or long-term progress.",
  parameters: z.object({}),
  execute: async () => {
    const all = await fetchTransactions();
    const netWorth = estimateNetWorth(all);
    const series = monthlySeries(all, 6);
    const last6Invested = series.reduce((acc, p) => acc + p.invested, 0);
    const avgMonthly = series.length ? last6Invested / series.length : 0;
    return {
      target_usd: MILLION_BY_30_TARGET,
      estimated_net_worth_usd: round(netWorth),
      progress: Math.round((netWorth / MILLION_BY_30_TARGET) * 10_000) / 10_000,
      remaining_usd: round(Math.max(0, MILLION_BY_30_TARGET - netWorth)),
      invested_last_6m_usd: round(last6Invested),
      avg_invested_per_month_usd: round(avgMonthly),
      monthly_breakdown: series.map((p) => ({
        month: p.month,
        income: round(p.income),
        expenses: round(p.expenses),
        invested: round(p.invested),
      })),
      note: "V1 net worth is a rough flow-based estimate: sum(income) - sum(expenses) + sum(invested). Real holdings + prices land in a later phase.",
    };
  },
});

export const listAccounts = tool({
  description:
    "List all accounts (checking, savings, brokerage, etc.) configured for Sameer.",
  parameters: z.object({}),
  execute: async () => {
    const accounts = await fetchAccounts();
    return {
      count: accounts.length,
      accounts: accounts.map((a) => ({ name: a.name, type: a.type })),
    };
  },
});

export const HOME_TOOLS = {
  list_transactions: listTransactions,
  monthly_summary: monthlySummary,
  top_categories: topCategories,
  goal_progress: goalProgress,
  list_accounts: listAccounts,
} as const;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function oneLineSummary(t: ReturnType<typeof monthlyTotals>): string {
  const flow = t.netCashFlow >= 0 ? "positive" : "negative";
  return `Income ${dollars(t.income)}, expenses ${dollars(t.expenses)}, invested ${dollars(
    t.invested,
  )}, net cash flow ${dollars(t.netCashFlow)} (${flow}).`;
}

function dollars(n: number): string {
  const v = Math.round(n);
  return `$${v.toLocaleString("en-US")}`;
}
