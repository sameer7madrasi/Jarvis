-- Jarvis – Supabase schema v2 (Phase 2: personas, portfolio, drafts, chat)
-- Apply via Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run: every statement uses IF NOT EXISTS / ON CONFLICT.
--
-- V1 (supabase/schema.sql + supabase/fix-rls-and-seed.sql) must be applied
-- first — it owns accounts, transactions, monthly_snapshots.

create extension if not exists "pgcrypto";

-- =========================================================================
-- holdings — Phase 2B
-- =========================================================================
create table if not exists public.holdings (
  id          uuid primary key default gen_random_uuid(),
  symbol      text not null,
  qty         numeric not null,
  cost_basis  numeric not null,
  account_id  uuid references public.accounts(id) on delete set null,
  opened_at   date not null default current_date,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists holdings_symbol_idx on public.holdings (symbol);
alter table public.holdings disable row level security;

-- =========================================================================
-- watchlist — Phase 2B
-- =========================================================================
create table if not exists public.watchlist (
  id        uuid primary key default gen_random_uuid(),
  symbol    text not null,
  note      text,
  added_at  timestamptz default now()
);

create unique index if not exists watchlist_symbol_unique on public.watchlist (symbol);
alter table public.watchlist disable row level security;

-- =========================================================================
-- drafts — Phase 2B / 2C (article research workspace)
-- =========================================================================
create table if not exists public.drafts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null,
  body_md         text not null default '',
  tags            text[] not null default '{}',
  status          text not null default 'idea',  -- idea | outline | drafting | ready | archived
  target_symbols  text[] not null default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create unique index if not exists drafts_slug_unique on public.drafts (slug);
create index if not exists drafts_status_idx        on public.drafts (status);
alter table public.drafts disable row level security;

-- =========================================================================
-- chat_conversations + chat_messages — Phase 2A
-- =========================================================================
create table if not exists public.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  persona_id  text not null,            -- 'home' | 'finance'
  title       text not null default 'New conversation',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists chat_conversations_persona_idx on public.chat_conversations (persona_id, updated_at desc);
alter table public.chat_conversations disable row level security;

create table if not exists public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.chat_conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant','system','tool')),
  content          text not null,
  meta             jsonb,
  created_at       timestamptz default now()
);

create index if not exists chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);
alter table public.chat_messages disable row level security;

-- =========================================================================
-- persona_configs — Phase 2 polish (overrides for built-in personas)
-- =========================================================================
create table if not exists public.persona_configs (
  id              uuid primary key default gen_random_uuid(),
  persona_id      text not null unique,    -- 'home' | 'finance'
  display_name    text,
  default_model   text,                    -- 'openai:gpt-4o-mini' etc
  system_prompt   text,
  color_hex       text,
  updated_at      timestamptz default now()
);

alter table public.persona_configs disable row level security;

-- =========================================================================
-- usage_log — Phase 2 polish (per-reply token + cost tracking)
-- =========================================================================
create table if not exists public.usage_log (
  id                   uuid primary key default gen_random_uuid(),
  persona_id           text not null,
  provider             text not null,
  model_id             text not null,
  prompt_tokens        integer not null default 0,
  completion_tokens    integer not null default 0,
  estimated_cost_usd   numeric not null default 0,
  created_at           timestamptz default now()
);

create index if not exists usage_log_created_idx on public.usage_log (created_at desc);
alter table public.usage_log disable row level security;

-- =========================================================================
-- Seed: starter holdings + watchlist (idempotent)
-- =========================================================================
do $$
declare
  brokerage_id uuid := (select id from public.accounts where name = 'Brokerage' limit 1);
  roth_id      uuid := (select id from public.accounts where name = 'Roth IRA' limit 1);
  crypto_id    uuid := (select id from public.accounts where name = 'Crypto Wallet' limit 1);
begin
  if not exists (select 1 from public.holdings) then
    insert into public.holdings (symbol, qty, cost_basis, account_id, opened_at) values
      ('AAPL',     12,    145.5,   brokerage_id, '2024-04-12'),
      ('MSFT',     8,     312.0,   brokerage_id, '2024-06-03'),
      ('NVDA',     5,     410.25,  brokerage_id, '2024-09-21'),
      ('VOO',      22,    392.0,   roth_id,      '2023-01-15'),
      ('BTC-USD',  0.18,  28400,   crypto_id,    '2023-06-09');
  end if;
end $$;

insert into public.watchlist (symbol, note) values
  ('TSLA', 'Q3 earnings angle'),
  ('PLTR', 'AI infra runner'),
  ('ASML', 'Semi capex cycle')
on conflict (symbol) do nothing;

-- =========================================================================
-- TODO (Phase 3 onwards)
-- =========================================================================
-- [ ] Add user_id (uuid references auth.users) to every table above.
-- [ ] Re-enable RLS with per-user policies.
-- [ ] Add posts / comments / subscriptions tables for the social phase.
-- [ ] Add holdings_history for true point-in-time portfolio valuation.
