/**
 * Provider-agnostic model factory.
 *
 * Personas declare their default model as a string like:
 *   "openai:gpt-4o-mini"
 *   "anthropic:claude-3-5-sonnet-20241022"
 *
 * This file resolves that string into a `LanguageModelV1` from the Vercel AI
 * SDK. Swap providers without touching call sites — change the persona's
 * default model, or set `JARVIS_AI_PROVIDER` / model env overrides.
 *
 * If no API key is configured for the resolved provider, `getModel` returns
 * `null` and callers should fall back to the offline persona response (see
 * `lib/ai/offline.ts`).
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";

export type ProviderName = "openai" | "anthropic";

export interface ResolvedModel {
  provider: ProviderName;
  modelId: string;
  model: LanguageModelV1;
}

/** Parse "openai:gpt-4o-mini" → { provider, modelId } */
export function parseModelSpec(spec: string): {
  provider: ProviderName;
  modelId: string;
} {
  const [p, ...rest] = spec.split(":");
  const provider = (p || "openai").toLowerCase() as ProviderName;
  const modelId = rest.join(":") || defaultModelFor(provider);
  return { provider, modelId };
}

export function defaultModelFor(provider: ProviderName): string {
  switch (provider) {
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "openai":
    default:
      return "gpt-4o-mini";
  }
}

export function isProviderConfigured(provider: ProviderName): boolean {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  return false;
}

/**
 * Returns the resolved LanguageModel for the given spec, or null if the
 * corresponding API key is not set. Honours `JARVIS_AI_PROVIDER` as a
 * global override (useful for forcing a specific provider in dev).
 */
export function getModel(spec: string): ResolvedModel | null {
  const override = (process.env.JARVIS_AI_PROVIDER || "").toLowerCase();
  const parsed = parseModelSpec(spec);
  const provider = (override || parsed.provider) as ProviderName;
  const modelId =
    override && override !== parsed.provider ? defaultModelFor(provider) : parsed.modelId;

  if (!isProviderConfigured(provider)) return null;

  let model: LanguageModelV1;
  if (provider === "anthropic") {
    const client = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    model = client(modelId);
  } else {
    const client = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    model = client(modelId);
  }

  return { provider, modelId, model };
}

export function anyProviderConfigured(): boolean {
  return isProviderConfigured("openai") || isProviderConfigured("anthropic");
}
