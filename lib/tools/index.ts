/**
 * Central tool registry. Per-persona allow-lists from `lib/personas/*`
 * filter which tools each chat session can call.
 */

import type { Tool } from "ai";

import { HOME_TOOLS } from "./transactions";
import { PORTFOLIO_TOOLS } from "./portfolio";
import { MARKET_TOOLS } from "./market";
import { DRAFT_TOOLS } from "./drafts";

export const ALL_TOOLS: Record<string, Tool> = {
  ...HOME_TOOLS,
  ...PORTFOLIO_TOOLS,
  ...MARKET_TOOLS,
  ...DRAFT_TOOLS,
};

/** Return only the tools whose names are in `allowed`. Unknown names are skipped. */
export function toolsFor(allowed: string[]): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const name of allowed) {
    const t = ALL_TOOLS[name];
    if (t) out[name] = t;
  }
  return out;
}

export const TOOL_NAMES = Object.keys(ALL_TOOLS);
