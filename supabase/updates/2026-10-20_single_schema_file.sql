-- ============================================================================
-- 2026-10-20_single_schema_file.sql — run ONCE on the existing (live) database
--
-- The 28 numbered migrations were merged into supabase/schema.sql. This brings
-- a database that ran them up to exactly that schema (version 1):
--   * Threads link (what 0028 did; skipped if you already ran it)
--   * schema_version(), which Settings → System now checks instead of
--     looking for each old migration
--   * app_system_status() without the old per-migration markers
--
-- Safe to run more than once. It first checks the older migrations were all
-- applied and stops, changing nothing, if one is missing.
-- ============================================================================

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'business_member_role' and e.enumlabel = 'admin') then v_missing := v_missing || '0008 admin role'; end if;
  if to_regprocedure('public.can_manage_role(uuid, business_member_role)') is null then v_missing := v_missing || '0009 team roles'; end if;
  if to_regprocedure('public.transfer_business_ownership(uuid)') is null then v_missing := v_missing || '0010 transfer ownership'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'receipt_number') then v_missing := v_missing || '0011 receipts'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'phone_key') then v_missing := v_missing || '0012 customer phone key'; end if;
  if to_regprocedure('public.app_is_set_up()') is null then v_missing := v_missing || '0013 single business'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'completed_on') then v_missing := v_missing || '0015 sale day'; end if;
  if to_regclass('public.push_subscriptions') is null then v_missing := v_missing || '0016 notifications'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'ready_stock') then v_missing := v_missing || '0017 ready stock'; end if;
  if not exists (select 1 from storage.buckets where id = 'product-images') then v_missing := v_missing || '0018 product photos'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'notification_preferences' and column_name = 'posting_reminder') then v_missing := v_missing || '0019 posting reminder'; end if;
  if to_regclass('public.product_recipe_items') is null then v_missing := v_missing || '0020 recipes'; end if;
  if not exists (select 1 from pg_proc where proname = 'set_order_completed_on' and prosrc like '%v_today%') then v_missing := v_missing || '0021 past sales'; end if;
  if to_regprocedure('public.app_system_status()') is null then v_missing := v_missing || '0022 system status'; end if;
  if not exists (select 1 from storage.buckets where id = 'catalogue') then v_missing := v_missing || '0023 menu catalogue'; end if;
  if not exists (select 1 from storage.buckets where id = 'avatars') then v_missing := v_missing || '0024 profile photos'; end if;
  if not exists (select 1 from pg_proc where proname = 'get_business_members' and pg_get_function_result(oid) like '%avatar_url%') then v_missing := v_missing || '0025 team photos'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'nicknames') then v_missing := v_missing || '0026 product nicknames'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'businesses' and column_name = 'instagram_url') then v_missing := v_missing || '0027 social links'; end if;

  if array_length(v_missing, 1) > 0 then
    raise exception 'This database is missing older migrations: %. Get them from the git history (supabase/migrations/) and run them first. Nothing was changed.',
      array_to_string(v_missing, ', ');
  end if;
end;
$$;

-- ---- Threads link (was 0028) -----------------------------------------------

alter table businesses add column if not exists threads_url text;

create or replace function get_public_menu()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'name', b.name,
    'phone', b.phone,
    'menu_pdf_url', b.menu_pdf_url,
    'menu_pdf_updated_at', b.menu_pdf_updated_at,
    'instagram_url', b.instagram_url,
    'facebook_url', b.facebook_url,
    'tiktok_url', b.tiktok_url,
    'threads_url', b.threads_url
  )
  from businesses b
  order by b.created_at
  limit 1;
$$;

revoke all on function get_public_menu() from public;
grant execute on function get_public_menu() to anon, authenticated;

-- ---- schema version --------------------------------------------------------

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 1;
$$;

revoke all on function schema_version() from public;
grant execute on function schema_version() to authenticated;

-- ---- system status, without the per-migration markers ----------------------

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
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function app_system_status() from public;
grant execute on function app_system_status() to authenticated;

select schema_version() as schema_version; -- should say 1
