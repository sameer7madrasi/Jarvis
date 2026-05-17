/**
 * Yahoo Finance implementation of MarketDataProvider — free, no API key.
 *
 * IMPLEMENTATION NOTE
 * -------------------
 * We deliberately do NOT depend on the `yahoo-finance2` npm package at
 * runtime. v2 of that package gates most endpoints behind Yahoo's
 * consent-cookie + crumb flow, which 429's frequently and adds a heavy
 * Deno-flavoured test bundle.
 *
 * Instead, we hit Yahoo's public web endpoints directly:
 *
 *   • Quote + history: GET https://query2.finance.yahoo.com/v8/finance/chart/{SYMBOL}
 *       — returns meta (price, currency, previousClose, marketState) + OHLCV
 *         in one call, with no crumb requirement.
 *   • News:           GET https://query1.finance.yahoo.com/v1/finance/search
 *       — also crumb-free.
 *
 * Server-side only. We send a desktop User-Agent so Yahoo doesn't 403 the
 * request, and a 10s timeout so a stuck Yahoo doesn't stall the chat loop.
 */

import type {
  HistoryPoint,
  HistoryRange,
  MarketDataProvider,
  NewsItem,
  Quote,
} from "./provider";

// Counter-intuitive: Yahoo's v8 chart endpoint 429s requests with a desktop
// browser User-Agent (Chrome/Safari) but returns 200 to requests with no UA
// or a generic non-browser UA. Real browsers are expected to go through the
// consent-cookie + crumb flow first; raw API consumers without a UA aren't
// subject to that gate. Confirmed empirically — see scripts/yf_probe.mjs.
const REQUEST_UA = "jarvis-fin/1.0";

const RANGE_TO_YF: Record<HistoryRange, { range: string; interval: string }> = {
  "1m": { range: "1mo", interval: "1d" },
  "3m": { range: "3mo", interval: "1d" },
  "6m": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "5y": { range: "5y", interval: "1wk" },
};

async function yfFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "user-agent": REQUEST_UA,
      accept: "application/json",
    },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(new Error(`Request timed out after ${ms}ms`)), ms);
  return { signal: c.signal, cancel: () => clearTimeout(id) };
}

interface ChartResult {
  meta: {
    currency?: string;
    symbol?: string;
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    regularMarketTime?: number;
    marketState?: string;
    longName?: string;
    shortName?: string;
    exchangeName?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }>;
  };
}

interface ChartResponse {
  chart: {
    result: ChartResult[] | null;
    error: { code?: string; description?: string } | null;
  };
}

async function fetchChart(
  symbol: string,
  opts: { range: string; interval: string },
): Promise<ChartResult> {
  const sym = encodeURIComponent(symbol.toUpperCase());
  const params = new URLSearchParams({
    range: opts.range,
    interval: opts.interval,
    includePrePost: "false",
  });
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?${params.toString()}`;
  const { signal, cancel } = withTimeout(10_000);
  try {
    const json = await yfFetch<ChartResponse>(url, signal);
    if (json.chart.error) {
      throw new Error(
        `Yahoo Finance error for ${sym}: ${json.chart.error.description ?? json.chart.error.code ?? "unknown"}`,
      );
    }
    const [result] = json.chart.result ?? [];
    if (!result) throw new Error(`No data returned for ${sym}`);
    return result;
  } finally {
    cancel();
  }
}

interface SearchResponse {
  news?: Array<{
    title: string;
    link: string;
    publisher?: string;
    providerPublishTime?: number;
  }>;
}

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",

  async quote(symbol) {
    const sym = symbol.toUpperCase();
    // 5-day range with daily interval is the cheapest call that still
    // contains a recent previousClose for accurate day-change math.
    const r = await fetchChart(sym, { range: "5d", interval: "1d" });
    const meta = r.meta;
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const lastClose = [...closes].reverse().find((v): v is number => typeof v === "number");
    const price = Number(meta.regularMarketPrice ?? lastClose ?? 0);
    const prevClose = Number(meta.previousClose ?? meta.chartPreviousClose ?? 0);
    const change = prevClose > 0 ? price - prevClose : 0;
    const changePct = prevClose > 0 ? change / prevClose : 0;
    return {
      symbol: sym,
      name: meta.longName ?? meta.shortName ?? undefined,
      price,
      change,
      change_pct: changePct,
      currency: meta.currency,
      market_state: meta.marketState,
      as_of: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    } satisfies Quote;
  },

  async history(symbol, range: HistoryRange) {
    const cfg = RANGE_TO_YF[range];
    const r = await fetchChart(symbol, cfg);
    const ts = r.timestamp ?? [];
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const volumes = r.indicators?.quote?.[0]?.volume ?? [];
    const out: HistoryPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = closes[i];
      if (typeof close !== "number") continue;
      out.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        close,
        volume: typeof volumes[i] === "number" ? volumes[i] as number : undefined,
      });
    }
    return out;
  },

  async news(symbol, limit = 5) {
    const sym = encodeURIComponent(symbol.toUpperCase());
    const url =
      `https://query1.finance.yahoo.com/v1/finance/search?q=${sym}` +
      `&quotesCount=0&newsCount=${Math.max(1, Math.min(limit, 15))}`;
    const { signal, cancel } = withTimeout(10_000);
    try {
      const json = await yfFetch<SearchResponse>(url, signal);
      const items: NewsItem[] = (json.news ?? []).slice(0, limit).map((n) => ({
        title: n.title,
        url: n.link,
        source: n.publisher,
        published_at: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : undefined,
      }));
      return items;
    } finally {
      cancel();
    }
  },
};
