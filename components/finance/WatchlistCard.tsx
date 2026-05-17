"use client";

import * as React from "react";
import { Eye } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { WatchlistItem } from "@/lib/types-v2";

interface Props {
  items: WatchlistItem[];
}

interface Live {
  symbol: string;
  price?: number;
  change_pct?: number;
  error?: string;
}

export function WatchlistCard({ items }: Props) {
  const [live, setLive] = React.useState<Record<string, Live>>({});

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const updates = await Promise.all(
        items.map(async (it) => {
          try {
            const res = await fetch(`/api/market?symbol=${encodeURIComponent(it.symbol)}&kind=quote`);
            const q = await res.json();
            if (!res.ok) throw new Error(q.error ?? "quote failed");
            return [it.symbol, { symbol: it.symbol, price: q.price, change_pct: q.change_pct }] as const;
          } catch (err) {
            return [it.symbol, { symbol: it.symbol, error: err instanceof Error ? err.message : "fail" }] as const;
          }
        }),
      );
      if (cancelled) return;
      setLive(Object.fromEntries(updates));
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
        <Eye size={16} className="text-ink-400" />
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-400">
            Nothing on the watchlist yet. Ask JarvisFinance to add a name.
          </div>
        ) : (
          <ul className="divide-y divide-ink-700/60">
            {items.map((it) => {
              const l = live[it.symbol];
              const up = (l?.change_pct ?? 0) >= 0;
              return (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <div className="font-mono text-sm font-semibold text-ink-100">{it.symbol}</div>
                  <div className="flex-1 truncate text-xs text-ink-400">{it.note ?? ""}</div>
                  <div className="text-right">
                    {l?.error || l?.price == null ? (
                      <span className="text-xs text-ink-500">—</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-xs tabular-nums text-ink-200">
                          ${l.price.toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] tabular-nums ${up ? "text-accent-500" : "text-danger-500"}`}
                        >
                          {up ? "+" : ""}
                          {((l.change_pct ?? 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
