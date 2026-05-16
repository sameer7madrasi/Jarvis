"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlySeries } from "@/lib/analytics";
import { ChartTooltip } from "./charts/ChartTooltip";
import type { Transaction } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  months?: number;
}

export function IncomeExpenseChart({ transactions, months = 6 }: Props) {
  const data = React.useMemo(
    () => monthlySeries(transactions, months),
    [transactions, months],
  );

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
          <Tooltip cursor={{ fill: "#13161d" }} content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#9ca3af", paddingTop: 8 }}
            iconType="circle"
          />
          <Bar dataKey="income" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
