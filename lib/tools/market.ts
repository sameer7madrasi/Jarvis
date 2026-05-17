/**
 * JarvisFinance market tools — live quotes, history and news. All routed
 * through the configured `MarketDataProvider`, default Yahoo.
 *
 * Tools NEVER throw. They always return `{ ok: true, ... } | { ok: false,
 * error, symbol }` so the model has a clean payload to narrate, even when
 * the upstream provider 4xx/5xxs.
 */

import { tool } from "ai";
import { z } from "zod";

import { getMarketProvider } from "../market";

function failure(symbol: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: false as const,
    symbol: symbol.toUpperCase(),
    error: message,
    hint: "Tell the user the data provider failed (briefly include the error), suggest retrying or trying another ticker; do NOT invent numbers.",
  };
}

export const getQuote = tool({
  description:
    "Fetch a live quote for a ticker (price, day change, market state). Use any time the user asks 'where is X trading' or 'what's the price of X'.",
  parameters: z.object({
    symbol: z.string().describe("Ticker symbol, e.g. 'AAPL', 'TSLA', 'BTC-USD'"),
  }),
  execute: async ({ symbol }) => {
    try {
      const q = await getMarketProvider().quote(symbol);
      return { ok: true as const, ...q };
    } catch (err) {
      return failure(symbol, err);
    }
  },
});

export const getHistory = tool({
  description:
    "Fetch historical closing prices for a ticker over a range. Use for context, trends, or to chart.",
  parameters: z.object({
    symbol: z.string(),
    range: z.enum(["1m", "3m", "6m", "1y", "5y"]).default("6m"),
  }),
  execute: async ({ symbol, range }) => {
    try {
      const history = await getMarketProvider().history(symbol, range);
      const first = history[0];
      const last = history[history.length - 1];
      return {
        ok: true as const,
        symbol: symbol.toUpperCase(),
        range,
        points: history.length,
        first: first ?? null,
        last: last ?? null,
        summary:
          first && last && first.close > 0
            ? {
                start_close: first.close,
                end_close: last.close,
                pct_change:
                  Math.round(((last.close - first.close) / first.close) * 10_000) / 10_000,
              }
            : null,
        // Truncate the time series payload so we don't blow the context
        // window on long ranges. The model rarely needs every point.
        history: history.slice(-60),
      };
    } catch (err) {
      return failure(symbol, err);
    }
  },
});

export const getNews = tool({
  description:
    "Fetch recent news headlines for a ticker. Use to find article angles or context for the user's questions.",
  parameters: z.object({
    symbol: z.string(),
    limit: z.number().int().min(1).max(15).default(5),
  }),
  execute: async ({ symbol, limit }) => {
    try {
      const items = await getMarketProvider().news(symbol, limit);
      return {
        ok: true as const,
        symbol: symbol.toUpperCase(),
        count: items.length,
        items,
      };
    } catch (err) {
      return failure(symbol, err);
    }
  },
});

export const MARKET_TOOLS = {
  get_quote: getQuote,
  get_history: getHistory,
  get_news: getNews,
} as const;
