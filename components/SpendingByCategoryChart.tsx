"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { spendingByCategory } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { ChartTooltip } from "./charts/ChartTooltip";
import type { Transaction } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  monthIso: string;
}

const PALETTE = [
  "#22c55e",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#3b82f6",
  "#a3a3a3",
];

export function SpendingByCategoryChart({ transactions, monthIso }: Props) {
  const data = React.useMemo(
    () => spendingByCategory(transactions, monthIso),
    [transactions, monthIso],
  );

  const total = data.reduce((acc, d) => acc + d.amount, 0);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-ink-400">
        No expenses recorded this month yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr]">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="#0c0e13"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col justify-center gap-1.5 text-sm">
        <div className="mb-1 text-xs uppercase tracking-wider text-ink-300">
          Total spent
        </div>
        <div className="mb-3 text-2xl font-semibold tabular-nums text-ink-100">
          {formatCurrency(total)}
        </div>
        <ul className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
          {data.map((d, i) => {
            const pct = total > 0 ? (d.amount / total) * 100 : 0;
            return (
              <li key={d.category} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="text-ink-200">{d.category}</span>
                <span className="ml-auto tabular-nums text-ink-300">
                  {formatCurrency(d.amount)}
                </span>
                <span className="w-10 text-right text-xs text-ink-400 tabular-nums">
                  {pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
