-- Jarvis – Supabase schema v3 (Phase 3: bank sync via Plaid + CSV)
-- Apply via Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run: every statement is idempotent.
--
-- Prerequisite: V1 (schema.sql + fix-rls-and-seed.sql) and V2 (schema_v2.sql
-- + fix-v2-rls-and-seed.sql) must be applied first.

create extension if not exists "pgcrypto";

-- =========================================================================
-- linked_items — one row per institution login (Plaid Item) or CSV source
-- =========================================================================
-- Holds the encrypted Plaid access_token. Each linked_item produces 1..N
-- rows in public.accounts (one per checking / savings / brokerage account
-- exposed by the institution).
create table if not exists public.linked_items (
  id                       uuid primary key default gen_random_uuid(),
  provider                 text not null default 'plaid',     -- 'plaid' | 'csv'
  provider_item_id         text,                              -- Plaid item_id
  institution_id           text,                              -- e.g. 'ins_127989' for BoA
  institution_name         text,
  encrypted_access_token   text,                              -- AES-256-GCM, see lib/banks/encryption.ts
  status                   text not null default 'active',    -- active | login_required | error
  last_synced_at           timestamptz,
  transactions_cursor      text,                              -- Plaid /transactions/sync cursor
  last_error               text,
  created_at               timestamptz default now()
);

create index if not exists linked_items_provider_idx on public.linked_items (provider);
create unique index if not exists linked_items_item_unique on public.linked_items (provider_item_id) where provider_item_id is not null;

alter table public.linked_items disable row level security;

-- If `linked_items` already existed from an older `schema_v3` run, `create table if not exists`
-- did not add columns added later (e.g. `last_error`). Patch idempotently.
alter table public.linked_items add column if not exists last_error text;

-- =========================================================================
-- accounts — extend so a row can be either manual or linked
-- =========================================================================
alter table public.accounts add column if not exists linked_item_id       uuid references public.linked_items(id) on delete set null;
alter table public.accounts add column if not exists provider_account_id  text;
alter table public.accounts add column if not exists mask                 text;
alter table public.accounts add column if not exists institution_name     text;

create unique index if not exists accounts_provider_account_unique
  on public.accounts (provider_account_id)
  where provider_account_id is not null;

-- =========================================================================
-- transactions — dedupe key for synced rows
-- =========================================================================
-- external_id is composed as:
--   plaid:<plaid_transaction_id>
--   csv:<accountId>:<yyyy-mm-dd>:<amount-cents>:<normalized-description>
alter table public.transactions add column if not exists external_id text;

create unique index if not exists transactions_external_unique
  on public.transactions (external_id)
  where external_id is not null;

-- =========================================================================
-- holdings — same dedupe pattern; lets Plaid Investments replace mocks
-- =========================================================================
alter table public.holdings add column if not exists external_id text;

create unique index if not exists holdings_external_unique
  on public.holdings (external_id)
  where external_id is not null;

-- =========================================================================
-- RLS off across the board (still single-user, see Phase 4 in plan)
-- =========================================================================
alter table public.linked_items disable row level security;

-- =========================================================================
-- TODO (Phase 4 / Social)
-- =========================================================================
-- [ ] Add user_id (uuid references auth.users) to linked_items so each user
--     owns their own bank connections; re-enable RLS with per-user policies.
-- [ ] Add a `linked_item_logs` table for auditing sync runs.
-- [ ] Move encrypted_access_token to Supabase Vault once it ships GA.
