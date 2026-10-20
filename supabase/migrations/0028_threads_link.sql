-- ============================================================================
-- 0028_threads_link.sql
--
-- Adds Threads to the shop's social links (see 0027). Same rules: stored as a
-- full https link, shown as a follow-us button on the public customer menu.
-- get_public_menu() now returns it too (still only public information).
-- ============================================================================

alter table businesses
  add column threads_url text;

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
