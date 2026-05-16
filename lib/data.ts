import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  MOCK_ACCOUNTS,
  MOCK_TRANSACTIONS,
  mockAddTransaction,
  mockDeleteTransaction,
} from "./mock";
import type { Account, NewTransaction, Transaction } from "./types";

/**
 * Thin data-access layer. Routes calls to Supabase when configured, otherwise
 * to the in-memory mock store. Keeping this in one file means components
 * never have to think about which backend is active.
 */

export async function fetchTransactions(): Promise<Transaction[]> {
  const sb = getSupabase();
  if (!sb) return [...MOCK_TRANSACTIONS];

  const { data, error } = await sb
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

export async function fetchAccounts(): Promise<Account[]> {
  const sb = getSupabase();
  if (!sb) return [...MOCK_ACCOUNTS];

  const { data, error } = await sb
    .from("accounts")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

export async function createTransaction(t: NewTransaction): Promise<Transaction> {
  const sb = getSupabase();
  if (!sb) {
    return mockAddTransaction(t);
  }

  const { data, error } = await sb
    .from("transactions")
    .insert({
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      type: t.type,
      category: t.category,
      account_id: t.account_id,
      notes: t.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    mockDeleteTransaction(id);
    return;
  }
  const { error } = await sb.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export { isSupabaseConfigured };
