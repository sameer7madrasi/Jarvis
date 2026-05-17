import { polygonProvider } from "./polygon";
import type { MarketDataProvider } from "./provider";
import { yahooProvider } from "./yahoo";

export type { MarketDataProvider, Quote, HistoryPoint, NewsItem, HistoryRange } from "./provider";

/**
 * Pick the active market data provider from env (`JARVIS_MARKET_PROVIDER`).
 * Defaults to Yahoo because it's free and key-less.
 */
export function getMarketProvider(): MarketDataProvider {
  const name = (process.env.JARVIS_MARKET_PROVIDER || "yahoo").toLowerCase();
  if (name === "polygon") return polygonProvider;
  return yahooProvider;
}
