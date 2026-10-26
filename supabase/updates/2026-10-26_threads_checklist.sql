-- ============================================================================
-- 2026-10-26_threads_checklist.sql — schema version 4 → 5
--
-- Threads joins the daily posting checklist on the Content page, so the
-- database must accept 'threads' as a content platform. Days before Threads
-- was added are still judged on the original three platforms (see
-- PLATFORM_SINCE in src/lib/content.ts), so streaks carry on.
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_saved_captions.sql),
-- BEFORE deploying the code that shows Threads. Safe to run again.
-- ============================================================================

alter type content_platform add value if not exists 'threads';

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 5;
$$;

select schema_version() as schema_version; -- should say 5
