-- ============================================================================
-- 2026-10-26_threads_checklist.sql — schema version 4 → 5
--
-- Threads joins the daily posting checklist on the Content page, so the
-- database must accept 'threads' as a content platform. Days before Threads
-- was added are still judged on the original three platforms (see
-- PLATFORM_SINCE in src/lib/content.ts), so streaks carry on.
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_saved_captions.sql),
-- BEFORE deploying the code that shows Threads. Running it twice is refused, changing nothing.
-- ============================================================================

-- Guard: refuses (and changes nothing) if this update is already applied, or
-- if the update before it hasn't been run. The whole file is one transaction.
do $guard$
declare
  v_version integer := case when to_regprocedure('public.schema_version()') is null then 0 else schema_version() end;
begin
  if v_version >= 5 then
    raise exception 'Already done: this database is at version %, and this file is version 5. Nothing was changed.', v_version;
  end if;
  if v_version < 4 then
    raise exception 'Run the earlier update files first: this database is at version %, and this file needs version 4. Nothing was changed.', v_version;
  end if;
end;
$guard$;

alter type content_platform add value if not exists 'threads';

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 5;
$$;

select schema_version() as schema_version; -- should say 5
