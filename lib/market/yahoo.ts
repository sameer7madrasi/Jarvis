/**
 * Yahoo Finance implementation of MarketDataProvider — free, no API key
 * required. Uses the well-maintained `yahoo-finance2` package.
 *
 * IMPORTANT: only call this from server-side code (`app/api/...` routes or
 * tool `execute` functions). The package uses Node-only modules.
 */

import yahooFinanceDefault from "yahoo-finance2";

import type {
  HistoryPoint,
  HistoryRange,
  MarketDataProvider,
  NewsItem,
  Quote,
} from "./provider";
import { rangeToPeriod } from "./provider";

// yahoo-finance2 v2 ships callable methods on the default export (singleton
// instance), but its published TS types describe it as a class constructor.
// Cast through a minimal surface we actually use so the rest of the file
// keeps strict typing.
interface YfQuote {
  regularMarketPrice?: number;
  preMarketPrice?: number;
  postMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  longName?: string;
  shortName?: string;
  currency?: string;
  marketState?: string;
  regularMarketTime?: number | Date | string;
}
interface YfChartRow {
  date: Date | string;
  close?: number;
  volume?: number;
}
interface YfNewsItem {
  title: string;
  link: string;
  publisher?: string;
  providerPublishTime?: number;
}
interface YahooFinanceLike {
  suppressNotices?: (n: string[]) => void;
  quote: (symbol: string) => Promise<YfQuote>;
  chart: (
    symbol: string,
    opts: { period1: Date; interval: "1d" | "1wk" },
  ) => Promise<{ quotes?: YfChartRow[] }>;
  search: (
    symbol: string,
    opts: { newsCount: number },
  ) => Promise<{ news?: YfNewsItem[] }>;
}

const yf = yahooFinanceDefault as unknown as YahooFinanceLike;

// Suppress noisy first-run survey notices.
yf.suppressNotices?.(["yahooSurvey", "ripHistorical"]);

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",

  async quote(symbol) {
    const sym = symbol.toUpperCase();
    const q = await yf.quote(sym);
    const priceRaw = q.regularMarketPrice ?? q.preMarketPrice ?? q.postMarketPrice ?? 0;
    return {
      symbol: sym,
      name: q.longName ?? q.shortName ?? undefined,
      price: Number(priceRaw),
      change: Number(q.regularMarketChange ?? 0),
      change_pct: Number(q.regularMarketChangePercent ?? 0),
      currency: q.currency ?? undefined,
      market_state: q.marketState ?? undefined,
      as_of:
        q.regularMarketTime != null
          ? new Date(
              typeof q.regularMarketTime === "number"
                ? q.regularMarketTime * 1000
                : q.regularMarketTime,
            ).toISOString()
          : new Date().toISOString(),
    };
  },

  async history(symbol, range: HistoryRange) {
    const { period1, interval } = rangeToPeriod(range);
    const rows = await yf.chart(symbol.toUpperCase(), { period1, interval });
    const out: HistoryPoint[] = (rows.quotes ?? [])
      .filter((r): r is YfChartRow & { close: number; date: Date | string } =>
        r.close != null && r.date != null,
      )
      .map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        close: Number(r.close),
        volume: r.volume != null ? Number(r.volume) : undefined,
      }));
    return out;
  },

  async news(symbol, limit = 5) {
    const res = await yf.search(symbol.toUpperCase(), { newsCount: limit });
    const items: NewsItem[] = (res.news ?? []).slice(0, limit).map((n) => ({
      title: n.title,
      url: n.link,
      source: n.publisher,
      published_at: n.providerPublishTime
        ? new Date(n.providerPublishTime).toISOString()
        : undefined,
      summary: undefined,
    }));
    return items;
  },
};
