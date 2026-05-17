/**
 * Phase 2 data-access layer — portfolio, watchlist, drafts, chat persistence,
 * usage logging. Same Supabase-or-mock dual mode as `lib/data.ts`.
 *
 * Tables are added by `supabase/schema_v2.sql`. If a table doesn't exist yet
 * (e.g. user hasn't applied schema_v2), the Supabase error bubbles up and the
 * caller can decide what to do — usually the API route catches and continues.
 */

import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  MOCK_CONVERSATIONS,
  MOCK_DRAFTS,
  MOCK_HOLDINGS,
  MOCK_MESSAGES,
  MOCK_WATCHLIST,
  nextId,
} from "./mock-v2";
import type {
  ChatConversation,
  ChatMessageRow,
  ChatRole,
  Draft,
  Holding,
  UsageLogRow,
  WatchlistItem,
} from "./types-v2";

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

export async function fetchHoldings(): Promise<Holding[]> {
  const sb = getSupabase();
  if (!sb) return [...MOCK_HOLDINGS];
  const { data, error } = await sb
    .from("holdings")
    .select("*")
    .order("symbol", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Holding[];
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const sb = getSupabase();
  if (!sb) return [...MOCK_WATCHLIST];
  const { data, error } = await sb
    .from("watchlist")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WatchlistItem[];
}

export async function addWatchlistItem(
  symbol: string,
  note?: string,
): Promise<WatchlistItem> {
  const sym = symbol.toUpperCase();
  const sb = getSupabase();
  if (!sb) {
    const item: WatchlistItem = {
      id: nextId("w"),
      symbol: sym,
      note: note ?? null,
      added_at: new Date().toISOString(),
    };
    MOCK_WATCHLIST.unshift(item);
    return item;
  }
  const { data, error } = await sb
    .from("watchlist")
    .insert({ symbol: sym, note: note ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as WatchlistItem;
}

export async function deleteWatchlistItem(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const idx = MOCK_WATCHLIST.findIndex((w) => w.id === id);
    if (idx >= 0) MOCK_WATCHLIST.splice(idx, 1);
    return;
  }
  const { error } = await sb.from("watchlist").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function fetchDrafts(): Promise<Draft[]> {
  const sb = getSupabase();
  if (!sb) return [...MOCK_DRAFTS];
  const { data, error } = await sb
    .from("drafts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Draft[];
}

export async function fetchDraftBySlug(slug: string): Promise<Draft | null> {
  const sb = getSupabase();
  if (!sb) return MOCK_DRAFTS.find((d) => d.slug === slug) ?? null;
  const { data, error } = await sb
    .from("drafts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Draft) ?? null;
}

export async function createDraft(input: {
  title: string;
  body_md?: string;
  target_symbols?: string[];
  tags?: string[];
}): Promise<Draft> {
  const slug = slugify(input.title) || `draft-${Date.now()}`;
  const now = new Date().toISOString();
  const payload: Omit<Draft, "id" | "created_at"> = {
    title: input.title,
    slug,
    body_md: input.body_md ?? `# ${input.title}\n\n`,
    tags: input.tags ?? [],
    status: "idea",
    target_symbols: input.target_symbols ?? [],
    updated_at: now,
  };
  const sb = getSupabase();
  if (!sb) {
    const draft: Draft = { ...payload, id: nextId("d"), created_at: now };
    MOCK_DRAFTS.unshift(draft);
    return draft;
  }
  const { data, error } = await sb.from("drafts").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as Draft;
}

export async function updateDraft(
  slug: string,
  patch: Partial<Pick<Draft, "title" | "body_md" | "status" | "tags" | "target_symbols">>,
): Promise<Draft> {
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (!sb) {
    const idx = MOCK_DRAFTS.findIndex((d) => d.slug === slug);
    if (idx < 0) throw new Error(`Draft not found: ${slug}`);
    MOCK_DRAFTS[idx] = { ...MOCK_DRAFTS[idx], ...patch, updated_at: now };
    return MOCK_DRAFTS[idx];
  }
  const { data, error } = await sb
    .from("drafts")
    .update({ ...patch, updated_at: now })
    .eq("slug", slug)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Draft;
}

export async function appendToDraft(slug: string, markdown: string): Promise<Draft> {
  const existing = await fetchDraftBySlug(slug);
  if (!existing) throw new Error(`Draft not found: ${slug}`);
  return updateDraft(slug, { body_md: `${existing.body_md}\n\n${markdown}`.trim() });
}

// ---------------------------------------------------------------------------
// Chat persistence
// ---------------------------------------------------------------------------

export async function createConversation(
  personaId: string,
  title: string,
): Promise<ChatConversation> {
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (!sb) {
    const conv: ChatConversation = {
      id: nextId("conv"),
      persona_id: personaId,
      title,
      created_at: now,
      updated_at: now,
    };
    MOCK_CONVERSATIONS.unshift(conv);
    return conv;
  }
  const { data, error } = await sb
    .from("chat_conversations")
    .insert({ persona_id: personaId, title })
    .select()
    .single();
  if (error) {
    // If table doesn't exist yet, fall back to mock so chat still works
    if (error.code === "42P01" || error.code === "PGRST205") {
      const conv: ChatConversation = {
        id: nextId("conv"),
        persona_id: personaId,
        title,
        created_at: now,
        updated_at: now,
      };
      MOCK_CONVERSATIONS.unshift(conv);
      return conv;
    }
    throw new Error(error.message);
  }
  return data as ChatConversation;
}

export async function listConversations(
  personaId: string,
): Promise<ChatConversation[]> {
  const sb = getSupabase();
  if (!sb) {
    return MOCK_CONVERSATIONS.filter((c) => c.persona_id === personaId);
  }
  const { data, error } = await sb
    .from("chat_conversations")
    .select("*")
    .eq("persona_id", personaId)
    .order("updated_at", { ascending: false });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return MOCK_CONVERSATIONS.filter((c) => c.persona_id === personaId);
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ChatConversation[];
}

export async function listMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const sb = getSupabase();
  if (!sb) {
    return MOCK_MESSAGES.filter((m) => m.conversation_id === conversationId);
  }
  const { data, error } = await sb
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return MOCK_MESSAGES.filter((m) => m.conversation_id === conversationId);
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ChatMessageRow[];
}

export async function appendMessage(input: {
  conversation_id: string;
  role: ChatRole;
  content: string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    MOCK_MESSAGES.push({
      id: nextId("msg"),
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      meta: input.meta ?? null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const { error } = await sb.from("chat_messages").insert(input);
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw new Error(error.message);
  }
}

export async function touchConversation(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const c = MOCK_CONVERSATIONS.find((x) => x.id === id);
    if (c) c.updated_at = new Date().toISOString();
    return;
  }
  const { error } = await sb
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    // non-fatal
    console.warn("touchConversation:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Usage logging
// ---------------------------------------------------------------------------

export async function logUsage(row: Omit<UsageLogRow, "id" | "created_at">): Promise<void> {
  const sb = getSupabase();
  if (!sb) return; // mock mode: don't bother
  const { error } = await sb.from("usage_log").insert(row);
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    console.warn("logUsage:", error.message);
  }
}

export { isSupabaseConfigured };
