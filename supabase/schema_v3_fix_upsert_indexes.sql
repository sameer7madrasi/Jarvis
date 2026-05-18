-- Jarvis — Supabase schema v3 hotfix: full unique indexes on external_id
--
-- The original schema_v3.sql created *partial* unique indexes:
--   ... WHERE external_id IS NOT NULL
-- PostgREST's `.upsert({ onConflict: 'external_id' })` issues
--   INSERT ... ON CONFLICT (external_id) DO UPDATE
-- and Postgres refuses to infer a partial unique index without the matching
-- predicate (which PostgREST does not expose). Every Plaid transactions /
-- holdings sync therefore failed with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- and the linked_items row was flipped to status='error'.
--
-- Fix: drop the partial indexes and recreate them as full unique indexes.
-- Postgres' default is NULLS DISTINCT, so multiple rows with
-- external_id IS NULL (manually-entered transactions / holdings) are still
-- allowed under a full unique index.
--
-- Apply via Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run: every statement is idempotent.

drop index if exists public.transactions_external_unique;
create unique index if not exists transactions_external_unique
  on public.transactions (external_id);

drop index if exists public.holdings_external_unique;
create unique index if not exists holdings_external_unique
  on public.holdings (external_id);

-- Reset any linked_items rows that were poisoned by the previous failed
-- syncs so the next "Sync now" starts from a clean slate. We don't touch
-- transactions_cursor — cursor-based /transactions/sync will pick up where
-- it left off (or from scratch if cursor was never set).
update public.linked_items
set status = 'active', last_error = null
where provider = 'plaid' and status = 'error';

-- Sanity-check (informational; uncomment and run on its own if you want
-- to verify the new index definitions):
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and indexname in ('transactions_external_unique', 'holdings_external_unique');
