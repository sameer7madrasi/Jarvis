-- Jarvis – Phase 2 fix-up
--
-- Supabase auto-enables RLS on tables created via the SQL editor. The
-- `alter table … disable row level security` lines in schema_v2.sql don't
-- always survive that, leaving anon-key writes blocked with
--   "new row violates row-level security policy for table …"
-- This script:
--   1. Explicitly disables RLS on every Phase 2 table (idempotent).
--   2. Re-runs the seed blocks for holdings + watchlist so the anon key
--      can read them. Drafts ships with a seed too — included.
--
-- Apply via Supabase Dashboard → SQL Editor → Run. Safe to re-run.

-- ── 1. RLS off (Phase 2 is still single-user, no auth) ────────────────────
alter table public.holdings            disable row level security;
alter table public.watchlist           disable row level security;
alter table public.drafts              disable row level security;
alter table public.chat_conversations  disable row level security;
alter table public.chat_messages       disable row level security;
alter table public.persona_configs     disable row level security;
alter table public.usage_log           disable row level security;

-- ── 2. Seed holdings (idempotent — only inserts if table is empty) ────────
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

-- ── 3. Seed watchlist (idempotent via unique index on symbol) ─────────────
insert into public.watchlist (symbol, note) values
  ('TSLA', 'Q3 earnings angle'),
  ('PLTR', 'AI infra runner'),
  ('ASML', 'Semi capex cycle')
on conflict (symbol) do nothing;

-- ── 4. Seed a starter draft so the workspace isn't empty ──────────────────
insert into public.drafts (title, slug, body_md, tags, status, target_symbols)
values (
  'Why NVDA''s data-center moat compounds harder than the bears think',
  'nvda-datacenter-moat',
  E'# Outline\n\n- TAM expansion vs gross margin\n- Networking + CUDA lock-in\n- Customer concentration risk (hyperscalers)\n- What I''d want to see in the next print\n',
  ARRAY['semis','ai'],
  'outline',
  ARRAY['NVDA']
)
on conflict (slug) do nothing;
