-- ============================================================================
-- 2026-10-30_catalogue_fallback.sql — schema version 8 → 9
--
-- A safety net for the customer menu's catalogue, in case it goes viral:
--   businesses.catalogue_link_url   a Canva / Google Drive link to the catalogue
--   businesses.catalogue_mode       what "View catalogue" opens:
--                                     'auto'   the uploaded PDF, switching to the
--                                              link at 80% of the month's free
--                                              data transfer (default)
--                                     'upload' always the uploaded PDF
--                                     'link'   always the link
--   businesses.menu_pdf_bytes       the PDF's size, for the estimate
--   businesses.catalogue_alerted_month  the month the 80% alert was sent
--   catalogue_opens.link_opens      opens served by the link (they use none of
--                                   Supabase's data allowance)
--   open_catalogue()                decides PDF or link, counts the open and says
--                                   when to alert the owner and admins, in one go
--   get_public_menu()               also returns the link
--
-- Run once in the Supabase SQL Editor (after 2026-10-30_atomic_saves.sql). Safe to run again.
-- ============================================================================

alter table businesses
  add column if not exists catalogue_link_url text,
  add column if not exists catalogue_mode text not null default 'auto',
  add column if not exists menu_pdf_bytes bigint,
  add column if not exists catalogue_alerted_month date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'businesses_catalogue_mode_valid') then
    alter table businesses add constraint businesses_catalogue_mode_valid check (catalogue_mode in ('auto', 'upload', 'link'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'businesses_catalogue_link_valid') then
    alter table businesses add constraint businesses_catalogue_link_valid
      check (catalogue_link_url is null or (catalogue_link_url like 'https://%' and length(catalogue_link_url) <= 500));
  end if;
end;
$$;

alter table catalogue_opens add column if not exists link_opens integer not null default 0;

-- One tap on "View catalogue": where to send the customer, counted, and
-- whether this is the moment to alert the owner/admins (once a month, at 80%
-- of p_limit_bytes of PDF downloads). Server only (service-role key).
create or replace function open_catalogue(p_limit_bytes bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b businesses;
  v_today date;
  v_month date;
  v_pdf_opens bigint;
  v_used bigint;
  v_threshold bigint := floor(p_limit_bytes * 0.8);
  v_use_link boolean;
  v_alert boolean := false;
begin
  select * into b from businesses order by created_at limit 1;
  if not found then
    return null;
  end if;

  v_today := (now() at time zone coalesce((select s.timezone from business_settings s where s.business_id = b.id), 'Asia/Kuala_Lumpur'))::date;
  v_month := date_trunc('month', v_today)::date;
  select coalesce(sum(opens), 0) into v_pdf_opens from catalogue_opens where business_id = b.id and day >= v_month;
  v_used := v_pdf_opens * coalesce(b.menu_pdf_bytes, 0);

  v_use_link := b.catalogue_link_url is not null
    and (b.catalogue_mode = 'link' or b.menu_pdf_url is null or (b.catalogue_mode = 'auto' and v_used >= v_threshold));
  if not v_use_link and b.menu_pdf_url is null then
    return null; -- no catalogue at all
  end if;

  -- First open at/after 80% this month: alert once (the update wins only once).
  if b.menu_pdf_bytes is not null and v_used >= v_threshold and b.catalogue_alerted_month is distinct from v_month then
    update businesses set catalogue_alerted_month = v_month where id = b.id and catalogue_alerted_month is distinct from v_month;
    v_alert := found;
  end if;

  insert into catalogue_opens (business_id, day, opens, link_opens)
  values (b.id, v_today, case when v_use_link then 0 else 1 end, case when v_use_link then 1 else 0 end)
  on conflict (business_id, day) do update
    set opens = catalogue_opens.opens + excluded.opens,
        link_opens = catalogue_opens.link_opens + excluded.link_opens;

  return jsonb_build_object(
    'url', case when v_use_link then b.catalogue_link_url else b.menu_pdf_url end,
    'via', case when v_use_link then 'link' else 'pdf' end,
    'pdf_url', b.menu_pdf_url,
    'pdf_bytes_known', b.menu_pdf_bytes is not null,
    'used_bytes', v_used,
    'alert', v_alert,
    'has_link', b.catalogue_link_url is not null,
    'mode', b.catalogue_mode,
    'business_id', b.id
  );
end;
$$;

revoke all on function open_catalogue(bigint) from public, anon, authenticated;
grant execute on function open_catalogue(bigint) to service_role;

-- Public (no sign-in): only what the /menu page shows, now with the catalogue link.
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
    'catalogue_link_url', b.catalogue_link_url,
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

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 9;
$$;

select schema_version() as schema_version; -- should say 9
