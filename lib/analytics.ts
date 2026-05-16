import type { Transaction } from "./types";
import { monthKey, monthLabel } from "./utils";

export interface MonthlyTotals {
  income: number;
  expenses: number;
  invested: number;
  netCashFlow: number;
  savingsRate: number; // 0..1
}

/** Returns a yyyy-mm-01 string for the first of the current month (UTC). */
export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

export function inMonth(t: Transaction, monthIso: string): boolean {
  return monthKey(t.date) === monthIso;
}

/** Aggregate totals for a given yyyy-mm-01 month string. */
export function monthlyTotals(
  transactions: Transaction[],
  monthIso: string,
): MonthlyTotals {
  let income = 0;
  let expenses = 0;
  let invested = 0;

  for (const t of transactions) {
    if (!inMonth(t, monthIso)) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.type === "income") income += amt;
    else if (t.type === "expense") expenses += amt;
    else if (t.type === "investment") invested += amt;
  }

  // Treat investments as cash out alongside expenses for true cash flow.
  const netCashFlow = income - expenses - invested;
  const savingsRate = income > 0 ? (income - expenses) / income : 0;

  return { income, expenses, invested, netCashFlow, savingsRate };
}

export interface CategorySlice {
  category: string;
  amount: number;
}

/** Group spending (expenses only) for a given month by category, sorted desc. */
export function spendingByCategory(
  transactions: Transaction[],
  monthIso: string,
): CategorySlice[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || !inMonth(t, monthIso)) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    map.set(t.category, (map.get(t.category) ?? 0) + amt);
  }
  return Array.from(map, ([category, amount]) => ({ category, amount })).sort(
    (a, b) => b.amount - a.amount,
  );
}

export interface MonthlySeriesPoint {
  /** yyyy-mm-01 */
  month: string;
  label: string; // "May 2026"
  income: number;
  expenses: number;
  invested: number;
}

/**
 * Aggregate income / expenses / invested by month for the last `months` months
 * (inclusive of the current month). Always returns `months` points so charts
 * render a stable x-axis even on empty data.
 */
export function monthlySeries(
  transactions: Transaction[],
  months = 6,
  now: Date = new Date(),
): MonthlySeriesPoint[] {
  const buckets = new Map<string, MonthlySeriesPoint>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    buckets.set(key, {
      month: key,
      label: monthLabel(key),
      income: 0,
      expenses: 0,
      invested: 0,
    });
  }

  for (const t of transactions) {
    const key = monthKey(t.date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.type === "income") bucket.income += amt;
    else if (t.type === "expense") bucket.expenses += amt;
    else if (t.type === "investment") bucket.invested += amt;
  }

  return Array.from(buckets.values());
}

/**
 * Very rough net worth estimate for V1:
 *   sum(income) - sum(expenses) + sum(invested)
 *
 * TODO: replace with real holdings + market prices in a later phase.
 */
export function estimateNetWorth(transactions: Transaction[]): number {
  let inc = 0,
    exp = 0,
    inv = 0;
  for (const t of transactions) {
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.type === "income") inc += amt;
    else if (t.type === "expense") exp += amt;
    else if (t.type === "investment") inv += amt;
  }
  return inc - exp + inv;
}
