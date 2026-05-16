import * as React from "react";
import { Sparkles, Target } from "lucide-react";
import { Card } from "./ui/Card";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface Props {
  /** Current rough net worth estimate */
  netWorth: number;
  /** Total invested in the current month */
  monthlyInvested: number;
  /** Goal target (defaults to $1M) */
  target?: number;
}

/**
 * Subtle progress + mindset panel tied to the "Million by 30" goal.
 * Intentionally motivational, never guilt-based.
 */
export function MindsetPanel({ netWorth, monthlyInvested, target = 1_000_000 }: Props) {
  const progress = Math.max(0, Math.min(1, netWorth / target));
  const remaining = Math.max(0, target - netWorth);

  return (
    <Card className="relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-invest-500/10 blur-3xl"
      />
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-invest-500/10 p-2 text-invest-500 ring-1 ring-invest-500/30">
          <Target size={18} />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-ink-300">
            A Million by 30
          </div>
          <div className="mt-0.5 text-base font-semibold text-ink-100">
            You&apos;re building, not budgeting.
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-xs uppercase tracking-wider text-ink-400">Target</div>
          <div className="text-sm font-semibold tabular-nums text-ink-200">
            {formatCurrency(target)}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-400">
              Estimated progress
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-ink-100">
              {formatPercent(progress, 2)}
            </div>
          </div>
          <div className="text-right text-xs text-ink-400">
            <div>{formatCurrency(remaining)} to go</div>
            <div className="text-ink-500">
              Invested this month: {formatCurrency(monthlyInvested)}
            </div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-700/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-invest-500 to-accent-500 transition-[width] duration-500"
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-ink-300">
        <Sparkles size={14} className="mt-0.5 text-invest-500" />
        <span>
          Every dollar you route to investments compounds. Focus on shipping income
          and routing the surplus — not on shaving lattes.
        </span>
      </div>
    </Card>
  );
}
