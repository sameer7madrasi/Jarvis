/**
 * Provider-agnostic market data interface. Default implementation is
 * Yahoo Finance (free, no key needed via the `yahoo-finance2` package).
 * A `polygon` stub is included so swapping later is mechanical.
 */

export interface Quote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  change_pct: number;
  currency?: string;
  market_state?: string;
  as_of?: string;
}

export interface HistoryPoint {
  date: string; // yyyy-mm-dd
  close: number;
  volume?: number;
}

export interface NewsItem {
  title: string;
  url: string;
  source?: string;
  published_at?: string;
  summary?: string;
}

export interface MarketDataProvider {
  name: string;
  quote(symbol: string): Promise<Quote>;
  history(symbol: string, range: HistoryRange): Promise<HistoryPoint[]>;
  news(symbol: string, limit?: number): Promise<NewsItem[]>;
}

export type HistoryRange = "1m" | "3m" | "6m" | "1y" | "5y";

export function rangeToPeriod(range: HistoryRange): { period1: Date; interval: "1d" | "1wk" } {
  const now = new Date();
  const period1 = new Date(now);
  switch (range) {
    case "1m":
      period1.setMonth(now.getMonth() - 1);
      return { period1, interval: "1d" };
    case "3m":
      period1.setMonth(now.getMonth() - 3);
      return { period1, interval: "1d" };
    case "6m":
      period1.setMonth(now.getMonth() - 6);
      return { period1, interval: "1d" };
    case "1y":
      period1.setFullYear(now.getFullYear() - 1);
      return { period1, interval: "1d" };
    case "5y":
      period1.setFullYear(now.getFullYear() - 5);
      return { period1, interval: "1wk" };
  }
}
