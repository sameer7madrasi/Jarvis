-- Jarvis – Supabase schema (V1)
-- Apply via Supabase Dashboard → SQL editor, or `supabase db push`.
--
-- This schema is intentionally minimal for V1. No auth, no RLS policies yet –
-- run this only against a personal project. Add RLS + auth in a later phase.

create extension if not exists "pgcrypto";

-- =========================================================================
-- accounts
-- =========================================================================
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null,              -- e.g. checking, savings, credit, brokerage, retirement, crypto, cash
  created_at  timestamptz default now()
);

-- =========================================================================
-- transactions
-- =========================================================================
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  merchant    text not null,
  amount      numeric not null,
  type        text not null check (type in ('income', 'expense', 'investment')),
  category    text not null,
  account_id  uuid references public.accounts(id) on delete set null,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists transactions_date_idx     on public.transactions (date desc);
create index if not exists transactions_type_idx     on public.transactions (type);
create index if not exists transactions_category_idx on public.transactions (category);

-- =========================================================================
-- monthly_snapshots
-- =========================================================================
-- Materialized monthly rollups. V1 can populate this from the client/server
-- after writes, or via a future Postgres function / cron job.
create table if not exists public.monthly_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  month                date not null,           -- first of the month, e.g. 2026-05-01
  income               numeric default 0,
  expenses             numeric default 0,
  invested             numeric default 0,
  net_cash_flow        numeric default 0,
  savings_rate         numeric default 0,
  estimated_net_worth  numeric default 0,
  created_at           timestamptz default now()
);

create unique index if not exists monthly_snapshots_month_unique
  on public.monthly_snapshots (month);

-- =========================================================================
-- Seed: default accounts
-- =========================================================================
insert into public.accounts (name, type) values
  ('Primary Checking', 'checking'),
  ('Emergency Savings', 'savings'),
  ('Main Credit Card',  'credit'),
  ('Brokerage',         'brokerage'),
  ('Roth IRA',          'retirement'),
  ('401k',              'retirement'),
  ('Crypto Wallet',     'crypto')
on conflict do nothing;

-- =========================================================================
-- TODO (future phases)
-- =========================================================================
-- [ ] Add `categories` table with (name, type, color) instead of free-text strings.
-- [ ] Add Row Level Security policies + auth.users foreign keys.
-- [ ] Add `plaid_items` + `plaid_accounts` tables for bank sync.
-- [ ] Add `holdings` (symbol, qty, cost_basis) for true net-worth tracking.
-- [ ] Add `ai_insights` table for generated commentary.
