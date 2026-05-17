/**
 * GET /api/market?symbol=AAPL&kind=quote|history|news&range=6m&limit=5
 *
 * Server-side proxy over the configured MarketDataProvider so paid-provider
 * API keys (Polygon etc.) never reach the client. Yahoo (the default) doesn't
 * need a key but goes through here too for consistency.
 */

import { NextResponse } from "next/server";
import { getMarketProvider, type HistoryRange } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  const kind = (url.searchParams.get("kind") ?? "quote").toLowerCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const provider = getMarketProvider();
  try {
    if (kind === "history") {
      const range = (url.searchParams.get("range") ?? "6m") as HistoryRange;
      const data = await provider.history(symbol, range);
      return NextResponse.json({ symbol: symbol.toUpperCase(), range, history: data });
    }
    if (kind === "news") {
      const limit = Math.min(15, Math.max(1, Number(url.searchParams.get("limit") ?? 5)));
      const data = await provider.news(symbol, limit);
      return NextResponse.json({ symbol: symbol.toUpperCase(), items: data });
    }
    const q = await provider.quote(symbol);
    return NextResponse.json(q);
  } catch (err) {
    const message = err instanceof Error ? err.message : "market provider error";
    return NextResponse.json({ error: message, symbol: symbol.toUpperCase() }, { status: 502 });
  }
}
