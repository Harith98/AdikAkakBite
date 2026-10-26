-- ============================================================================
-- 2026-10-26_device_names.sql — schema version 6 → 7
--
-- A name for each device with notifications on ("Harith's iPhone", "Kitchen
-- iPad"), asked for when turning notifications on. Websites can't read a
-- phone's model, so this is how Settings → System status tells devices apart.
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_admin_system_status.sql). Safe to run again.
-- ============================================================================

alter table push_subscriptions add column if not exists device_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_device_name_length') then
    alter table push_subscriptions
      add constraint push_subscriptions_device_name_length check (device_name is null or length(device_name) between 1 and 40);
  end if;
end;
$$;

comment on column push_subscriptions.device_name is 'Name the person gave this device ("Harith''s iPhone"), shown in Settings → System status.';

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 7;
$$;

select schema_version() as schema_version; -- should say 7
