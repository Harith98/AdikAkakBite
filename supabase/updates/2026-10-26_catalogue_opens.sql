-- ============================================================================
-- 2026-10-26_catalogue_opens.sql — schema version 2 → 3
--
-- Counts how often customers open the menu's catalogue PDF, one row per day,
-- so Settings → System can estimate how much of Supabase's free monthly data
-- transfer (5 GB) the PDF uses: opens × PDF size.
--
-- The menu's catalogue button goes through /menu/catalogue, which calls
-- count_catalogue_open() with the server's service-role key and then sends
-- the customer on to the PDF. Nobody else can call it, so the count can't be
-- inflated from outside the app.
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_expenses.sql). Running it twice is refused, changing nothing.
-- ============================================================================

-- Guard: refuses (and changes nothing) if this update is already applied, or
-- if the update before it hasn't been run. The whole file is one transaction.
do $guard$
declare
  v_version integer := case when to_regprocedure('public.schema_version()') is null then 0 else schema_version() end;
begin
  if v_version >= 3 then
    raise exception 'Already done: this database is at version %, and this file is version 3. Nothing was changed.', v_version;
  end if;
  if v_version < 2 then
    raise exception 'Run the earlier update files first: this database is at version %, and this file needs version 2. Nothing was changed.', v_version;
  end if;
end;
$guard$;

create table if not exists catalogue_opens (
  business_id uuid not null references businesses(id) on delete cascade,
  day date not null,
  opens integer not null default 0,
  primary key (business_id, day)
);
comment on table catalogue_opens is 'Catalogue PDF opens per business-local day, for the data-transfer estimate in Settings → System.';

alter table catalogue_opens enable row level security;
drop policy if exists "members can view catalogue opens" on catalogue_opens;
create policy "members can view catalogue opens"
  on catalogue_opens for select
  using (is_business_member(business_id));

-- +1 for today (business-local day), atomically.
create or replace function count_catalogue_open()
returns void
language sql
security definer
set search_path = public
as $$
  insert into catalogue_opens (business_id, day, opens)
  select
    b.id,
    (now() at time zone coalesce((select s.timezone from business_settings s where s.business_id = b.id), 'Asia/Kuala_Lumpur'))::date,
    1
  from businesses b
  order by b.created_at
  limit 1
  on conflict (business_id, day) do update set opens = catalogue_opens.opens + 1;
$$;

revoke all on function count_catalogue_open() from public, anon, authenticated;
grant execute on function count_catalogue_open() to service_role;

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 3;
$$;

select schema_version() as schema_version; -- should say 3
