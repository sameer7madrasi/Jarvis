/**
 * In-memory Phase 2 stores. Mirrors the V1 `lib/mock.ts` pattern: if Supabase
 * env vars (or the Phase 2 tables) aren't set, the UI/AI still work against
 * realistic-looking data so the experience is end-to-end demo-able.
 */

import type {
  Draft,
  Holding,
  WatchlistItem,
  ChatConversation,
  ChatMessageRow,
} from "./types-v2";

let idCounter = 1;
export const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

export const MOCK_HOLDINGS: Holding[] = [
  {
    id: nextId("h"),
    symbol: "AAPL",
    qty: 12,
    cost_basis: 145.5,
    account_id: "acc-brokerage",
    opened_at: "2024-04-12",
  },
  {
    id: nextId("h"),
    symbol: "MSFT",
    qty: 8,
    cost_basis: 312.0,
    account_id: "acc-brokerage",
    opened_at: "2024-06-03",
  },
  {
    id: nextId("h"),
    symbol: "NVDA",
    qty: 5,
    cost_basis: 410.25,
    account_id: "acc-brokerage",
    opened_at: "2024-09-21",
  },
  {
    id: nextId("h"),
    symbol: "VOO",
    qty: 22,
    cost_basis: 392.0,
    account_id: "acc-roth",
    opened_at: "2023-01-15",
  },
  {
    id: nextId("h"),
    symbol: "BTC-USD",
    qty: 0.18,
    cost_basis: 28_400,
    account_id: "acc-crypto",
    opened_at: "2023-06-09",
  },
];

export const MOCK_WATCHLIST: WatchlistItem[] = [
  { id: nextId("w"), symbol: "TSLA", note: "Q3 earnings angle", added_at: new Date().toISOString() },
  { id: nextId("w"), symbol: "PLTR", note: "AI infra runner", added_at: new Date().toISOString() },
  { id: nextId("w"), symbol: "ASML", note: "Semi capex cycle", added_at: new Date().toISOString() },
];

export const MOCK_DRAFTS: Draft[] = [
  {
    id: nextId("d"),
    title: "Why NVDA's data-center moat compounds harder than the bears think",
    slug: "nvda-datacenter-moat",
    body_md:
      "# Outline\n\n- TAM expansion vs gross margin\n- Networking + CUDA lock-in\n- Customer concentration risk (hyperscalers)\n- What I'd want to see in the next print\n",
    tags: ["semis", "ai"],
    status: "outline",
    target_symbols: ["NVDA"],
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_CONVERSATIONS: ChatConversation[] = [];
export const MOCK_MESSAGES: ChatMessageRow[] = [];
