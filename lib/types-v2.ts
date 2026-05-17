/**
 * Phase 2 domain types — portfolio, drafts, chat persistence.
 * Mirrors the new tables in `supabase/schema_v2.sql`.
 */

export interface Holding {
  id: string;
  symbol: string;
  qty: number;
  cost_basis: number;
  account_id: string | null;
  opened_at: string; // yyyy-mm-dd
  notes?: string | null;
  created_at?: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  note?: string | null;
  added_at: string;
}

export type DraftStatus = "idea" | "outline" | "drafting" | "ready" | "archived";

export interface Draft {
  id: string;
  title: string;
  slug: string;
  body_md: string;
  tags: string[];
  status: DraftStatus;
  target_symbols: string[];
  updated_at: string;
  created_at?: string;
}

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatConversation {
  id: string;
  persona_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  /** Optional JSON metadata: tool calls, tool results, usage, etc. */
  meta?: Record<string, unknown> | null;
  created_at: string;
}

export interface UsageLogRow {
  id: string;
  persona_id: string;
  provider: string;
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
}
