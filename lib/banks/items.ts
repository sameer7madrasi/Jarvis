/**
 * Supabase-backed CRUD for `linked_items` (one row per Plaid Item or CSV
 * source). Mirrors the Supabase-or-mock pattern from lib/data.ts but Plaid
 * features hard-require Supabase — there's no useful mock-mode equivalent
 * for storing real bank credentials.
 */

import { getSupabase } from "../supabase";
import { decrypt, encrypt } from "./encryption";

export interface LinkedItem {
  id: string;
  provider: "plaid" | "csv";
  provider_item_id: string | null;
  institution_id: string | null;
  institution_name: string | null;
  status: "active" | "login_required" | "error";
  last_synced_at: string | null;
  transactions_cursor: string | null;
  last_error: string | null;
  created_at: string;
}

export interface LinkedItemWithToken extends LinkedItem {
  access_token: string;
}

function requireSb() {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase is not configured — bank sync requires NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return sb;
}

export async function listItems(): Promise<LinkedItem[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("linked_items")
    .select(
      "id, provider, provider_item_id, institution_id, institution_name, status, last_synced_at, transactions_cursor, last_error, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LinkedItem[];
}

export async function getItem(id: string): Promise<LinkedItem | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("linked_items")
    .select(
      "id, provider, provider_item_id, institution_id, institution_name, status, last_synced_at, transactions_cursor, last_error, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LinkedItem) ?? null;
}

/** Returns the decrypted access token, or null if the row isn't a Plaid item. */
export async function getItemWithToken(id: string): Promise<LinkedItemWithToken | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("linked_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!data.encrypted_access_token) {
    throw new Error(`linked_items row ${id} has no encrypted_access_token`);
  }
  return {
    ...(data as LinkedItem),
    access_token: decrypt(data.encrypted_access_token as string),
  };
}

export async function findItemByProviderItemId(
  providerItemId: string,
): Promise<LinkedItem | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("linked_items")
    .select("*")
    .eq("provider_item_id", providerItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LinkedItem) ?? null;
}

export async function createPlaidItem(input: {
  provider_item_id: string;
  institution_id?: string | null;
  institution_name?: string | null;
  access_token: string;
}): Promise<LinkedItem> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("linked_items")
    .insert({
      provider: "plaid",
      provider_item_id: input.provider_item_id,
      institution_id: input.institution_id ?? null,
      institution_name: input.institution_name ?? null,
      encrypted_access_token: encrypt(input.access_token),
      status: "active",
    })
    .select(
      "id, provider, provider_item_id, institution_id, institution_name, status, last_synced_at, transactions_cursor, last_error, created_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return data as LinkedItem;
}

export async function updateItem(
  id: string,
  patch: Partial<{
    status: LinkedItem["status"];
    last_synced_at: string;
    transactions_cursor: string;
    last_error: string | null;
  }>,
): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("linked_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteItem(id: string): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("linked_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
