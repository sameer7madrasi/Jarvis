/**
 * Very rough per-1M-token pricing in USD. Used only to render a friendly
 * "this reply cost ~$0.003" chip — not for billing. Update as providers ship.
 */

import type { ProviderName } from "./provider";

interface PriceRow {
  input: number; // $ per 1M input tokens
  output: number; // $ per 1M output tokens
}

const PRICES: Record<string, PriceRow> = {
  "openai:gpt-4o":             { input: 2.5, output: 10 },
  "openai:gpt-4o-mini":        { input: 0.15, output: 0.6 },
  "openai:gpt-4-turbo":        { input: 10, output: 30 },
  "anthropic:claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "anthropic:claude-3-5-haiku-20241022":  { input: 0.8, output: 4 },
  "anthropic:claude-3-opus-20240229":     { input: 15, output: 75 },
};

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export function estimateCostUsd(
  provider: ProviderName,
  modelId: string,
  usage: Usage,
): number {
  const key = `${provider}:${modelId}`;
  const row = PRICES[key];
  if (!row) return 0;
  const cost =
    (usage.promptTokens / 1_000_000) * row.input +
    (usage.completionTokens / 1_000_000) * row.output;
  return Math.round(cost * 10_000) / 10_000; // 4 decimals
}

export function formatCost(usd: number): string {
  if (usd === 0) return "—";
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}
