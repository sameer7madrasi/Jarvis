-- Capital OS – V1 fix-up
-- Supabase auto-enables RLS on new tables created via the dashboard. V1 has
-- no auth, so we explicitly disable RLS and (idempotently) re-seed accounts.
--
-- Apply via Supabase Dashboard → SQL Editor (paste + Run).
-- Safe to re-run.

-- 1. Disable RLS on all three tables (V1 only — re-enable in Phase 2 with auth).
alter table public.accounts          disable row level security;
alter table public.transactions      disable row level security;
alter table public.monthly_snapshots disable row level security;

-- 2. Seed accounts (idempotent on name).
-- We use a unique-on-name pattern so re-runs don't duplicate.
create unique index if not exists accounts_name_unique on public.accounts (name);

insert into public.accounts (name, type) values
  ('Primary Checking', 'checking'),
  ('Emergency Savings', 'savings'),
  ('Main Credit Card',  'credit'),
  ('Brokerage',         'brokerage'),
  ('Roth IRA',          'retirement'),
  ('401k',              'retirement'),
  ('Crypto Wallet',     'crypto')
on conflict (name) do nothing;
