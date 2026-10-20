-- ============================================================================
-- 0022_system_status.sql
--
-- app_system_status(): what Settings → System status shows the owner —
-- database and photo-storage size (to compare with the Supabase free plan),
-- row counts, number of logins, and which migrations are applied.
--
-- SECURITY DEFINER because it reads sizes and auth/storage tables a normal
-- user can't; it refuses anyone who isn't the business owner. It returns
-- numbers and yes/no checks only — never any customer or account details.
-- ============================================================================

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
  if not exists (select 1 from business_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can view system status.';
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
    ),
    -- One marker per migration: something that only exists once it has run.
    'migrations', jsonb_build_object(
      '0008', exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'business_member_role' and e.enumlabel = 'admin'),
      '0009', to_regprocedure('public.can_manage_role(uuid, business_member_role)') is not null,
      '0010', to_regprocedure('public.transfer_business_ownership(uuid)') is not null,
      '0011', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'receipt_number'),
      '0012', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'phone_key'),
      '0013', to_regprocedure('public.app_is_set_up()') is not null,
      '0014', exists (select 1 from pg_proc where proname = 'get_business_members' and pg_get_function_result(oid) like '%display_name%'),
      '0015', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'completed_on'),
      '0016', to_regclass('public.push_subscriptions') is not null,
      '0017', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'ready_stock'),
      '0018', exists (select 1 from storage.buckets where id = 'product-images'),
      '0019', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'notification_preferences' and column_name = 'posting_reminder'),
      '0020', to_regclass('public.product_recipe_items') is not null,
      '0021', exists (select 1 from pg_proc where proname = 'set_order_completed_on' and prosrc like '%v_today%'),
      '0022', true
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function app_system_status() from public;
grant execute on function app_system_status() to authenticated;
