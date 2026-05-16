"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  LineChart as LineChartIcon,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { MetricCard } from "./MetricCard";
import { MindsetPanel } from "./MindsetPanel";
import { TransactionForm } from "./TransactionForm";
import { TransactionTable } from "./TransactionTable";
import { SpendingByCategoryChart } from "./SpendingByCategoryChart";
import { IncomeExpenseChart } from "./IncomeExpenseChart";
import { InvestmentChart } from "./InvestmentChart";
import { Card, CardBody, CardHeader, CardTitle } from "./ui/Card";

import {
  createTransaction,
  deleteTransaction,
  fetchAccounts,
  fetchTransactions,
  isSupabaseConfigured,
} from "@/lib/data";
import {
  currentMonthKey,
  estimateNetWorth,
  monthlyTotals,
} from "@/lib/analytics";
import { formatCurrency, formatPercent, monthLabel } from "@/lib/utils";
import type { Account, NewTransaction, Transaction } from "@/lib/types";

export function Dashboard() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const usingMock = !isSupabaseConfigured();

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [txs, accs] = await Promise.all([fetchTransactions(), fetchAccounts()]);
      setTransactions(txs);
      setAccounts(accs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAdd(t: NewTransaction) {
    const created = await createTransaction(t);
    setTransactions((prev) => [created, ...prev]);
  }

  async function handleDelete(id: string) {
    const prev = transactions;
    setTransactions((p) => p.filter((t) => t.id !== id));
    try {
      await deleteTransaction(id);
    } catch (err) {
      setTransactions(prev);
      setError(err instanceof Error ? err.message : "Failed to delete transaction.");
    }
  }

  const monthIso = currentMonthKey();
  const totals = React.useMemo(
    () => monthlyTotals(transactions, monthIso),
    [transactions, monthIso],
  );
  const netWorth = React.useMemo(() => estimateNetWorth(transactions), [transactions]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Header usingMock={usingMock} monthIso={monthIso} />

      {error && (
        <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Metric grid */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Income"
              value={formatCurrency(totals.income)}
              hint="This month"
              tone="positive"
              icon={<ArrowUpRight size={16} />}
            />
            <MetricCard
              label="Expenses"
              value={formatCurrency(totals.expenses)}
              hint="This month"
              tone="negative"
              icon={<ArrowDownRight size={16} />}
            />
            <MetricCard
              label="Net Cash Flow"
              value={formatCurrency(totals.netCashFlow)}
              hint="Income − Expenses − Invested"
              tone={totals.netCashFlow >= 0 ? "positive" : "negative"}
              icon={<Wallet size={16} />}
            />
            <MetricCard
              label="Savings Rate"
              value={formatPercent(totals.savingsRate)}
              hint="(Income − Expenses) / Income"
              tone={totals.savingsRate >= 0.2 ? "positive" : "muted"}
              icon={<PiggyBank size={16} />}
            />
            <MetricCard
              label="Invested"
              value={formatCurrency(totals.invested)}
              hint="Routed to wealth this month"
              tone="invest"
              icon={<TrendingUp size={16} />}
            />
            <MetricCard
              label="Est. Net Worth"
              value={formatCurrency(netWorth)}
              hint="Placeholder — V1 estimate"
              tone="neutral"
              icon={<Banknote size={16} />}
            />
          </section>

          {/* Charts + mindset */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <span className="text-xs text-ink-400">Last 6 months</span>
              </CardHeader>
              <CardBody>
                <IncomeExpenseChart transactions={transactions} />
              </CardBody>
            </Card>

            <MindsetPanel netWorth={netWorth} monthlyInvested={totals.invested} />

            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <span className="text-xs text-ink-400">{monthLabel(monthIso)}</span>
              </CardHeader>
              <CardBody>
                <SpendingByCategoryChart
                  transactions={transactions}
                  monthIso={monthIso}
                />
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Investment Contributions</CardTitle>
                <LineChartIcon size={16} className="text-invest-500" />
              </CardHeader>
              <CardBody>
                <InvestmentChart transactions={transactions} />
              </CardBody>
            </Card>
          </section>

          {/* Transactions + Form */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Transactions</CardTitle>
                <span className="text-xs text-ink-400">
                  {transactions.length} total
                </span>
              </CardHeader>
              <CardBody>
                <TransactionTable
                  transactions={transactions}
                  accounts={accounts}
                  onDelete={handleDelete}
                />
              </CardBody>
            </Card>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Add Transaction</CardTitle>
                <Sparkles size={16} className="text-ink-300" />
              </CardHeader>
              <CardBody>
                <TransactionForm accounts={accounts} onSubmit={handleAdd} />
              </CardBody>
            </Card>
          </section>

          <Footer />
        </>
      )}
    </main>
  );
}

function Header({ usingMock, monthIso }: { usingMock: boolean; monthIso: string }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-ink-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
          Capital OS
        </div>
        <h1 className="mt-1 text-3xl font-semibold text-ink-100">
          Money Command Center
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          {monthLabel(monthIso)} · personal capital allocation for the Million by 30 plan.
        </p>
      </div>
      {usingMock ? (
        <div className="rounded-full border border-ink-700 bg-ink-800/60 px-3 py-1 text-xs text-ink-300">
          Mock data mode · set Supabase env vars to persist
        </div>
      ) : (
        <div className="rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-xs text-accent-500">
          Connected to Supabase
        </div>
      )}
    </header>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-ink-700/50 bg-ink-900/60"
        />
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="pt-6 text-center text-xs text-ink-500">
      Capital OS · V1 · built with Next.js, Supabase &amp; Recharts.
      {/* TODO: wire Plaid sync for automatic transactions. */}
      {/* TODO: add AI insights (monthly review, anomaly detection, allocation suggestions). */}
    </footer>
  );
}
