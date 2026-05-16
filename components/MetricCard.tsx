import * as React from "react";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "invest" | "muted";

const toneRing: Record<Tone, string> = {
  neutral: "ring-ink-700/60",
  positive: "ring-accent-500/40",
  negative: "ring-danger-500/40",
  invest: "ring-invest-500/40",
  muted: "ring-ink-700/40",
};

const toneText: Record<Tone, string> = {
  neutral: "text-ink-100",
  positive: "text-accent-500",
  negative: "text-danger-500",
  invest: "text-invest-500",
  muted: "text-ink-300",
};

export interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  trailing?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  trailing,
}: MetricCardProps) {
  return (
    <Card className={cn("p-5 ring-1", toneRing[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-300">
          {label}
        </div>
        {icon ? <div className="text-ink-300">{icon}</div> : null}
      </div>
      <div className={cn("mt-3 text-3xl font-semibold tabular-nums", toneText[tone])}>
        {value}
      </div>
      {(hint || trailing) && (
        <div className="mt-2 flex items-center justify-between text-xs text-ink-400">
          <span>{hint}</span>
          {trailing}
        </div>
      )}
    </Card>
  );
}
