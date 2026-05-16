"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";

interface Payload {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface Props {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
}

export function ChartTooltip({ active, payload, label }: Props) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/95 px-3 py-2 text-xs shadow-lg">
      {label != null ? (
        <div className="mb-1 font-medium text-ink-100">{label}</div>
      ) : null}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: p.color ?? "#9ca3af" }}
            />
            <span className="text-ink-300">{p.name}</span>
            <span className="ml-auto font-medium text-ink-100 tabular-nums">
              {formatCurrency(Number(p.value ?? 0), true)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
