"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlySeries } from "@/lib/analytics";
import { ChartTooltip } from "./charts/ChartTooltip";
import { formatCurrency } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  months?: number;
}

export function InvestmentChart({ transactions, months = 6 }: Props) {
  const data = React.useMemo(() => {
    const series = monthlySeries(transactions, months);
    let cumulative = 0;
    return series.map((p) => {
      cumulative += p.invested;
      return { ...p, cumulative };
    });
  }, [transactions, months]);

  const total = data.length ? data[data.length - 1].cumulative : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-ink-300">
          Cumulative contributions ({months}m)
        </div>
        <div className="text-lg font-semibold tabular-nums text-invest-500">
          {formatCurrency(total)}
        </div>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b1f28" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="invested"
              name="Contributed"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#investGrad)"
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="Cumulative"
              stroke="#c4b5fd"
              strokeWidth={2}
              fillOpacity={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
