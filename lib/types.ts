// Core domain types shared across the app.
// These mirror the Supabase schema in `supabase/schema.sql`.

export type TransactionType = "income" | "expense" | "investment";

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "brokerage"
  | "retirement"
  | "crypto"
  | "cash";

export interface Account {
  id: string;
  name: string;
  type: AccountType | string;
  created_at?: string;
}

export interface Transaction {
  id: string;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
  merchant: string;
  amount: number;
  type: TransactionType;
  category: string;
  account_id: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface MonthlySnapshot {
  id: string;
  /** First day of the month as ISO date string (yyyy-mm-01) */
  month: string;
  income: number;
  expenses: number;
  invested: number;
  net_cash_flow: number;
  savings_rate: number;
  estimated_net_worth: number;
  created_at?: string;
}

/** Form payload used by `TransactionForm` (no id / created_at yet). */
export type NewTransaction = Omit<Transaction, "id" | "created_at">;
