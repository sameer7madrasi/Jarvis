-- Jarvis – Phase 3 fix-up
--
-- Supabase auto-enables RLS on tables created via the SQL editor. The
-- `alter table … disable row level security` line in schema_v3.sql doesn't
-- always survive that pass. This script explicitly disables RLS on the
-- Phase 3 table so anon-key writes from the dev server succeed.
--
-- Apply via Supabase Dashboard → SQL Editor → Run. Safe to re-run.

alter table public.linked_items disable row level security;

-- Columns added after some early `linked_items` installs (create table if not exists skips them).
alter table public.linked_items add column if not exists last_error text;
