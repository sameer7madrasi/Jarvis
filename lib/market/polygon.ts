/**
 * Polygon.io stub — drop-in replacement for the Yahoo provider once you
 * upgrade to paid market data. Reads POLYGON_API_KEY from env.
 *
 * TODO: implement against https://polygon.io/docs/stocks
 *   - GET /v2/aggs/ticker/{symbol}/prev → quote
 *   - GET /v2/aggs/ticker/{symbol}/range/1/day/{from}/{to} → history
 *   - GET /v2/reference/news?ticker={symbol} → news
 */

import type { MarketDataProvider } from "./provider";

export const polygonProvider: MarketDataProvider = {
  name: "polygon",
  async quote() {
    throw new Error("Polygon provider not yet implemented — see lib/market/polygon.ts");
  },
  async history() {
    throw new Error("Polygon provider not yet implemented");
  },
  async news() {
    throw new Error("Polygon provider not yet implemented");
  },
};
