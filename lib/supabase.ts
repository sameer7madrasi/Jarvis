import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client + env detection.
 *
 * V1 has no auth, so we use the anon client for both reads and writes against
 * a personal project. If the env vars are missing, `isSupabaseConfigured()`
 * returns false and the app falls back to in-memory mock data (see `lib/mock.ts`).
 *
 * TODO: when adding auth, switch writes to a server route that uses the
 * service-role key and proper RLS policies.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  browserClient = createClient(url as string, anonKey as string, {
    auth: { persistSession: false },
  });
  return browserClient;
}
