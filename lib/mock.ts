import type { Account, Transaction } from "./types";

/**
 * Local-only mock dataset. Used automatically whenever Supabase env vars are
 * not set, so the dashboard renders end-to-end with realistic numbers.
 *
 * Dates are generated relative to "today" so the current-month metrics always
 * have something to show.
 */

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoThisMonth(day: number): string {
  const d = new Date();
  d.setDate(day);
  return d.toISOString().slice(0, 10);
}

function isoMonthsAgo(monthsAgo: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, day);
  return d.toISOString().slice(0, 10);
}

export const MOCK_ACCOUNTS: Account[] = [
  { id: "acc-checking",  name: "Primary Checking",  type: "checking" },
  { id: "acc-savings",   name: "Emergency Savings", type: "savings" },
  { id: "acc-credit",    name: "Main Credit Card",  type: "credit" },
  { id: "acc-brokerage", name: "Brokerage",         type: "brokerage" },
  { id: "acc-roth",      name: "Roth IRA",          type: "retirement" },
  { id: "acc-401k",      name: "401k",              type: "retirement" },
  { id: "acc-crypto",    name: "Crypto Wallet",     type: "crypto" },
];

let idCounter = 1;
const nextId = () => `mock-${idCounter++}`;

function makeMonth(monthsAgo: number): Transaction[] {
  const day = (n: number) =>
    monthsAgo === 0 ? isoThisMonth(n) : isoMonthsAgo(monthsAgo, n);

  return [
    {
      id: nextId(),
      date: day(1),
      merchant: "Acme Corp Payroll",
      amount: 7200,
      type: "income",
      category: "Salary",
      account_id: "acc-checking",
      notes: "Bi-monthly paycheck",
    },
    {
      id: nextId(),
      date: day(15),
      merchant: "Acme Corp Payroll",
      amount: 7200,
      type: "income",
      category: "Salary",
      account_id: "acc-checking",
    },
    {
      id: nextId(),
      date: day(3),
      merchant: "Skyline Apartments",
      amount: 2400,
      type: "expense",
      category: "Rent",
      account_id: "acc-checking",
    },
    {
      id: nextId(),
      date: day(5),
      merchant: "Whole Foods",
      amount: 184.32,
      type: "expense",
      category: "Groceries",
      account_id: "acc-credit",
    },
    {
      id: nextId(),
      date: day(7),
      merchant: "Equinox",
      amount: 235,
      type: "expense",
      category: "Fitness",
      account_id: "acc-credit",
    },
    {
      id: nextId(),
      date: day(9),
      merchant: "Uber",
      amount: 42.15,
      type: "expense",
      category: "Transportation",
      account_id: "acc-credit",
    },
    {
      id: nextId(),
      date: day(11),
      merchant: "Sushi Note",
      amount: 96.4,
      type: "expense",
      category: "Restaurants",
      account_id: "acc-credit",
    },
    {
      id: nextId(),
      date: day(13),
      merchant: "Netflix",
      amount: 22.99,
      type: "expense",
      category: "Subscriptions",
      account_id: "acc-credit",
    },
    {
      id: nextId(),
      date: day(18),
      merchant: "Vanguard",
      amount: 583,
      type: "investment",
      category: "Roth IRA",
      account_id: "acc-roth",
      notes: "Monthly auto-contribution",
    },
    {
      id: nextId(),
      date: day(18),
      merchant: "Fidelity",
      amount: 1200,
      type: "investment",
      category: "Brokerage",
      account_id: "acc-brokerage",
    },
    {
      id: nextId(),
      date: day(20),
      merchant: "401k Employer Match",
      amount: 900,
      type: "investment",
      category: "401k",
      account_id: "acc-401k",
    },
    {
      id: nextId(),
      date: day(22),
      merchant: "Coinbase",
      amount: 250,
      type: "investment",
      category: "Crypto",
      account_id: "acc-crypto",
    },
  ];
}

const recentTransactions: Transaction[] = [
  ...makeMonth(0),
  ...makeMonth(1),
  ...makeMonth(2),
  ...makeMonth(3),
  ...makeMonth(4),
  ...makeMonth(5),
  // a couple of one-offs
  {
    id: nextId(),
    date: isoDaysAgo(2),
    merchant: "Side Project Stripe",
    amount: 480,
    type: "income",
    category: "Side Income",
    account_id: "acc-checking",
    notes: "Consulting invoice",
  },
  {
    id: nextId(),
    date: isoDaysAgo(4),
    merchant: "Delta Airlines",
    amount: 612,
    type: "expense",
    category: "Travel",
    account_id: "acc-credit",
  },
];

/** Mutable in-memory store so new transactions added in the UI persist for the session. */
export const MOCK_TRANSACTIONS: Transaction[] = recentTransactions.sort(
  (a, b) => (a.date < b.date ? 1 : -1),
);

export function mockAddTransaction(t: Omit<Transaction, "id">): Transaction {
  const created: Transaction = { ...t, id: nextId(), created_at: new Date().toISOString() };
  MOCK_TRANSACTIONS.unshift(created);
  return created;
}

export function mockDeleteTransaction(id: string): void {
  const idx = MOCK_TRANSACTIONS.findIndex((t) => t.id === id);
  if (idx >= 0) MOCK_TRANSACTIONS.splice(idx, 1);
}
