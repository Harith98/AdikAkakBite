-- ============================================================================
-- 0027_social_links.sql
--
-- The shop's social media pages (Settings → Business & receipt details),
-- shown as buttons at the bottom of the public customer menu. Stored as full
-- https links; the app turns "@handle" into the right link when saving.
-- get_public_menu() now returns them too (still only public information).
-- ============================================================================

alter table businesses
  add column instagram_url text,
  add column facebook_url text,
  add column tiktok_url text;

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
    'tiktok_url', b.tiktok_url
  )
  from businesses b
  order by b.created_at
  limit 1;
$$;

revoke all on function get_public_menu() from public;
grant execute on function get_public_menu() to anon, authenticated;
