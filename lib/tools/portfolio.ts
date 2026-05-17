/**
 * JarvisFinance portfolio tools. Combines holdings data (lib/data-v2.ts)
 * with live quotes (lib/market) to compute P&L on demand.
 */

import { tool } from "ai";
import { z } from "zod";

import {
  addWatchlistItem,
  fetchHoldings,
  fetchWatchlist,
} from "../data-v2";
import { getMarketProvider } from "../market";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const listHoldings = tool({
  description:
    "List Sameer's current portfolio holdings (symbol, qty, cost basis, account). Static data — call get_quote separately for live prices.",
  parameters: z.object({}),
  execute: async () => {
    const holdings = await fetchHoldings();
    return {
      count: holdings.length,
      holdings: holdings.map((h) => ({
        symbol: h.symbol,
        qty: h.qty,
        cost_basis: h.cost_basis,
        opened_at: h.opened_at,
        account_id: h.account_id,
      })),
    };
  },
});

export const portfolioValue = tool({
  description:
    "Compute live portfolio market value, total cost basis, unrealized P&L and per-position breakdown. Fetches live quotes for every holding.",
  parameters: z.object({}),
  execute: async () => {
    const holdings = await fetchHoldings();
    const provider = getMarketProvider();
    const positions = await Promise.all(
      holdings.map(async (h) => {
        try {
          const q = await provider.quote(h.symbol);
          const market_value = q.price * h.qty;
          const cost = h.cost_basis * h.qty;
          const pnl = market_value - cost;
          return {
            symbol: h.symbol,
            qty: h.qty,
            price: round(q.price),
            cost_basis: h.cost_basis,
            market_value: round(market_value),
            cost: round(cost),
            unrealized_pnl: round(pnl),
            unrealized_pnl_pct: cost > 0 ? Math.round((pnl / cost) * 10_000) / 10_000 : 0,
            day_change_pct: round(q.change_pct),
          };
        } catch (err) {
          return {
            symbol: h.symbol,
            qty: h.qty,
            cost_basis: h.cost_basis,
            error: err instanceof Error ? err.message : "quote failed",
          };
        }
      }),
    );
    const market_value = positions.reduce<number>(
      (acc, p) =>
        acc + (p && typeof (p as { market_value?: number }).market_value === "number"
          ? (p as { market_value: number }).market_value
          : 0),
      0,
    );
    const cost = positions.reduce<number>(
      (acc, p) =>
        acc + (p && typeof (p as { cost?: number }).cost === "number"
          ? (p as { cost: number }).cost
          : 0),
      0,
    );
    return {
      total_market_value: round(market_value),
      total_cost: round(cost),
      total_unrealized_pnl: round(market_value - cost),
      total_unrealized_pnl_pct: cost > 0 ? Math.round(((market_value - cost) / cost) * 10_000) / 10_000 : 0,
      positions,
    };
  },
});

export const positionPnl = tool({
  description:
    "Get the live P&L for a specific symbol in Sameer's portfolio. Use when he asks about a single ticker.",
  parameters: z.object({
    symbol: z.string().describe("Ticker symbol, e.g. 'NVDA'"),
  }),
  execute: async ({ symbol }) => {
    const holdings = await fetchHoldings();
    const sym = symbol.toUpperCase();
    const h = holdings.find((x) => x.symbol.toUpperCase() === sym);
    if (!h) return { error: `No position found for ${sym}` };
    const provider = getMarketProvider();
    const q = await provider.quote(sym);
    const market_value = q.price * h.qty;
    const cost = h.cost_basis * h.qty;
    const pnl = market_value - cost;
    return {
      symbol: sym,
      qty: h.qty,
      cost_basis: h.cost_basis,
      price: round(q.price),
      market_value: round(market_value),
      unrealized_pnl: round(pnl),
      unrealized_pnl_pct: cost > 0 ? Math.round((pnl / cost) * 10_000) / 10_000 : 0,
      day_change_pct: round(q.change_pct),
    };
  },
});

export const listWatchlist = tool({
  description: "List the symbols Sameer is watching, with any notes attached.",
  parameters: z.object({}),
  execute: async () => {
    const items = await fetchWatchlist();
    return {
      count: items.length,
      watchlist: items.map((w) => ({ symbol: w.symbol, note: w.note, added_at: w.added_at })),
    };
  },
});

export const addToWatchlist = tool({
  description:
    "Add a symbol to Sameer's watchlist with an optional note explaining why. Write action — confirm with the user before calling.",
  parameters: z.object({
    symbol: z.string().describe("Ticker symbol to add"),
    note: z.string().optional().describe("Why this is on the watchlist"),
  }),
  execute: async ({ symbol, note }) => {
    const item = await addWatchlistItem(symbol, note);
    return {
      added: true,
      symbol: item.symbol,
      note: item.note ?? null,
    };
  },
});

export const PORTFOLIO_TOOLS = {
  list_holdings: listHoldings,
  portfolio_value: portfolioValue,
  position_pnl: positionPnl,
  list_watchlist: listWatchlist,
  add_to_watchlist: addToWatchlist,
} as const;
