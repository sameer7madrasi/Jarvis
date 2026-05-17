"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Holding } from "@/lib/types-v2";

interface Position {
  symbol: string;
  qty: number;
  price: number;
  cost_basis: number;
  market_value: number;
  cost: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  day_change_pct: number;
  error?: string;
}

interface Props {
  holdings: Holding[];
}

export function PortfolioTable({ holdings }: Props) {
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        holdings.map(async (h) => {
          try {
            const res = await fetch(`/api/market?symbol=${encodeURIComponent(h.symbol)}&kind=quote`);
            const q = await res.json();
            if (!res.ok) throw new Error(q.error ?? "quote failed");
            const market_value = q.price * h.qty;
            const cost = h.cost_basis * h.qty;
            const pnl = market_value - cost;
            return {
              symbol: h.symbol,
              qty: h.qty,
              price: Number(q.price),
              cost_basis: Number(h.cost_basis),
              market_value,
              cost,
              unrealized_pnl: pnl,
              unrealized_pnl_pct: cost > 0 ? pnl / cost : 0,
              day_change_pct: Number(q.change_pct),
            } as Position;
          } catch (err) {
            return {
              symbol: h.symbol,
              qty: h.qty,
              price: 0,
              cost_basis: Number(h.cost_basis),
              market_value: 0,
              cost: h.cost_basis * h.qty,
              unrealized_pnl: 0,
              unrealized_pnl_pct: 0,
              day_change_pct: 0,
              error: err instanceof Error ? err.message : "quote failed",
            } as Position;
          }
        }),
      );
      setPositions(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totals = positions.reduce(
    (acc, p) => {
      acc.mv += p.market_value;
      acc.cost += p.cost;
      return acc;
    },
    { mv: 0, cost: 0 },
  );
  const totalPnl = totals.mv - totals.cost;
  const totalPnlPct = totals.cost > 0 ? totalPnl / totals.cost : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={load}
          disabled={loading}
          className="text-ink-300"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-ink-700/60 bg-ink-900/60 p-3">
          <Stat label="Market value" value={formatCurrency(totals.mv)} />
          <Stat label="Cost basis" value={formatCurrency(totals.cost)} muted />
          <Stat
            label="Unrealized P&L"
            value={`${totalPnl >= 0 ? "+" : "−"}${formatCurrency(Math.abs(totalPnl))}`}
            sub={formatPercent(totalPnlPct, 2)}
            tone={totalPnl >= 0 ? "positive" : "negative"}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-ink-700/60">
          <table className="w-full text-xs">
            <thead className="bg-ink-800/60 text-[10px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Symbol</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/60">
              {positions.map((p) => (
                <tr key={p.symbol} className="hover:bg-ink-800/40">
                  <td className="px-3 py-2 font-mono font-semibold text-ink-100">{p.symbol}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-300">{p.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-200">
                    {p.error ? "—" : formatCurrency(p.price, true)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      p.day_change_pct >= 0 ? "text-accent-500" : "text-danger-500",
                    )}
                  >
                    {p.error ? "—" : (
                      <span className="inline-flex items-center gap-0.5">
                        {p.day_change_pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {(p.day_change_pct * 100).toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums font-medium",
                      p.unrealized_pnl >= 0 ? "text-accent-500" : "text-danger-500",
                    )}
                  >
                    {p.error ? (
                      <span className="text-ink-500">offline</span>
                    ) : (
                      <>
                        {p.unrealized_pnl >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(p.unrealized_pnl))}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {positions.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-400">
                    No holdings yet. Add some via the markets editor (coming soon).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "positive" && "text-accent-500",
          tone === "negative" && "text-danger-500",
          muted && "text-ink-300",
        )}
      >
        {value}
      </div>
      {sub ? <div className="text-[10px] text-ink-400">{sub}</div> : null}
    </div>
  );
}
