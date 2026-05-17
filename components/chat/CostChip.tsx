"use client";

import { formatCost, type Usage } from "@/lib/ai";
import type { ProviderName } from "@/lib/ai";

interface Props {
  provider?: ProviderName | string;
  modelId?: string;
  usage?: Usage;
  cost?: number;
}

export function CostChip({ provider, modelId, usage, cost }: Props) {
  if (!provider && !modelId && !usage && cost == null) return null;
  const total = (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-800/60 px-2 py-0.5 text-[10px] text-ink-400">
      {modelId ? <span className="font-mono">{modelId}</span> : null}
      {total > 0 ? <span>· {total} tok</span> : null}
      {cost != null ? <span>· {formatCost(cost)}</span> : null}
    </div>
  );
}
