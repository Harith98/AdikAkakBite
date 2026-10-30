-- ============================================================================
-- 2026-10-26_admin_system_status.sql — schema version 5 → 6
--
-- Admins can open Settings → System status too (it was owner only). Same
-- numbers as before: sizes, row counts and logins, never customer details.
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_threads_checklist.sql). Running it twice is refused, changing nothing.
-- ============================================================================

-- Guard: refuses (and changes nothing) if this update is already applied, or
-- if the update before it hasn't been run. The whole file is one transaction.
do $guard$
declare
  v_version integer := case when to_regprocedure('public.schema_version()') is null then 0 else schema_version() end;
begin
  if v_version >= 6 then
    raise exception 'Already done: this database is at version %, and this file is version 6. Nothing was changed.', v_version;
  end if;
  if v_version < 5 then
    raise exception 'Run the earlier update files first: this database is at version %, and this file needs version 5. Nothing was changed.', v_version;
  end if;
end;
$guard$;

create or replace function app_system_status()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from business_members where user_id = auth.uid() and role in ('owner', 'admin')) then
    raise exception 'Only the owner or an admin can view system status.';
  end if;

  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'product-images'), 0),
    'storage_files', (select count(*) from storage.objects where bucket_id = 'product-images'),
    'auth_users', (select count(*) from auth.users),
    'rows', jsonb_build_object(
      'orders', (select count(*) from orders),
      'order_items', (select count(*) from order_items),
      'customers', (select count(*) from customers),
      'products', (select count(*) from products),
      'inventory_transactions', (select count(*) from inventory_transactions),
      'tasks', (select count(*) from tasks),
      'activity_logs', (select count(*) from business_activity_logs)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function app_system_status() from public;
grant execute on function app_system_status() to authenticated;

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 6;
$$;

select schema_version() as schema_version; -- should say 6
