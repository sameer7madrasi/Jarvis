/**
 * JarvisFinance market tools — live quotes, history and news. All routed
 * through the configured `MarketDataProvider`, default Yahoo.
 */

import { tool } from "ai";
import { z } from "zod";

import { getMarketProvider } from "../market";

export const getQuote = tool({
  description:
    "Fetch a live quote for a ticker (price, day change, market state). Use any time the user asks 'where is X trading'.",
  parameters: z.object({
    symbol: z.string().describe("Ticker symbol, e.g. 'AAPL', 'TSLA', 'BTC-USD'"),
  }),
  execute: async ({ symbol }) => {
    const q = await getMarketProvider().quote(symbol);
    return q;
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
    const history = await getMarketProvider().history(symbol, range);
    return {
      symbol: symbol.toUpperCase(),
      range,
      points: history.length,
      first: history[0] ?? null,
      last: history[history.length - 1] ?? null,
      summary:
        history.length >= 2
          ? {
              start_close: history[0].close,
              end_close: history[history.length - 1].close,
              pct_change:
                history[0].close > 0
                  ? Math.round(((history[history.length - 1].close - history[0].close) / history[0].close) * 10_000) / 10_000
                  : 0,
            }
          : null,
      history,
    };
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
    const items = await getMarketProvider().news(symbol, limit);
    return {
      symbol: symbol.toUpperCase(),
      count: items.length,
      items,
    };
  },
});

export const MARKET_TOOLS = {
  get_quote: getQuote,
  get_history: getHistory,
  get_news: getNews,
} as const;
