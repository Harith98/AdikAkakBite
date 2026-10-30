-- ============================================================================
-- 2026-10-30_admin_system_status_again.sql — schema version 9 → 10
--
-- Puts back the owner-OR-admin version of app_system_status() (Settings →
-- System status usage). An older update file run again after version 6 had
-- brought back the owner-only one ("Only the owner can view system status").
-- From this version on, every update file refuses to run twice or out of order.
--
-- Run once in the Supabase SQL Editor (after 2026-10-30_catalogue_fallback.sql).
-- ============================================================================

-- Guard: refuses (and changes nothing) if this update is already applied, or
-- if the update before it hasn't been run. The whole file is one transaction.
do $guard$
declare
  v_version integer := case when to_regprocedure('public.schema_version()') is null then 0 else schema_version() end;
begin
  if v_version >= 10 then
    raise exception 'Already done: this database is at version %, and this file is version 10. Nothing was changed.', v_version;
  end if;
  if v_version < 9 then
    raise exception 'Run the earlier update files first: this database is at version %, and this file needs version 9. Nothing was changed.', v_version;
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
  select 10;
$$;

select schema_version() as schema_version; -- should say 10
