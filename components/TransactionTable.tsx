"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Select } from "./ui/Field";
import { ALL_CATEGORIES } from "@/lib/categories";
import { formatCurrency, formatDate, monthKey, monthLabel } from "@/lib/utils";
import type { Account, Transaction, TransactionType } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  onDelete?: (id: string) => Promise<void> | void;
}

type TypeFilter = TransactionType | "all";

const typeStyles: Record<TransactionType, { sign: string; className: string; pill: string }> = {
  income: {
    sign: "+",
    className: "text-accent-500",
    pill: "bg-accent-500/10 text-accent-500 ring-accent-500/30",
  },
  expense: {
    sign: "−",
    className: "text-danger-500",
    pill: "bg-danger-500/10 text-danger-500 ring-danger-500/30",
  },
  investment: {
    sign: "→",
    className: "text-invest-500",
    pill: "bg-invest-500/10 text-invest-500 ring-invest-500/30",
  },
};

export function TransactionTable({ transactions, accounts, onDelete }: Props) {
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [monthFilter, setMonthFilter] = React.useState<string>("all");

  const accountById = React.useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const monthOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) set.add(monthKey(t.date));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  const filtered = React.useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (monthFilter !== "all" && monthKey(t.date) !== monthFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, monthFilter]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
        >
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
          <option value="investment">Investments</option>
        </Select>
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="all">All months</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-700/60">
        <table className="w-full text-sm">
          <thead className="bg-ink-800/60 text-xs uppercase tracking-wider text-ink-300">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Merchant</th>
              <th className="px-4 py-2 text-left font-medium">Category</th>
              <th className="px-4 py-2 text-left font-medium">Account</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              {onDelete ? <th className="w-10 px-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/60">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={onDelete ? 6 : 5}
                  className="px-4 py-10 text-center text-sm text-ink-400"
                >
                  No transactions match the current filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((t) => {
                const tone = typeStyles[t.type];
                const account = t.account_id ? accountById.get(t.account_id) : null;
                return (
                  <tr key={t.id} className="hover:bg-ink-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">{t.merchant}</div>
                      {t.notes ? (
                        <div className="text-xs text-ink-400">{t.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone.pill}`}
                      >
                        {t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-300">
                      {account ? account.name : "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${tone.className}`}
                    >
                      {tone.sign}
                      {formatCurrency(Math.abs(Number(t.amount) || 0), true)}
                    </td>
                    {onDelete ? (
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => onDelete(t.id)}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-700/60 hover:text-danger-500"
                          aria-label="Delete transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 100 ? (
        <div className="text-center text-xs text-ink-400">
          Showing first 100 of {filtered.length} matching transactions.
        </div>
      ) : null}
    </div>
  );
}
