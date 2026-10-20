-- ============================================================================
-- 0023_menu_catalogue.sql
--
-- The customer menu (/menu): the shop's PDF catalogue plus an order form that
-- sends the WhatsApp order template to the business number.
--
--   businesses.menu_pdf_url / menu_pdf_updated_at   the current catalogue
--   storage bucket `catalogue`                      public PDFs, max 50 MB,
--                                                   uploaded by owner/admin only
--   get_public_menu()                               what /menu may read without
--                                                   signing in: name, phone, PDF link
-- ============================================================================

alter table businesses
  add column menu_pdf_url text,
  add column menu_pdf_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogue', 'catalogue', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner/admin of the business named by the file's first folder.
create or replace function can_manage_catalogue_file(object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from businesses b
    where b.id::text = (storage.foldername(object_name))[1]
      and can_manage_business(b.id)
  );
$$;

create policy "managers can read catalogue files"
  on storage.objects for select to authenticated
  using (bucket_id = 'catalogue' and can_manage_catalogue_file(name));

create policy "managers can upload catalogue files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogue' and can_manage_catalogue_file(name));

create policy "managers can delete catalogue files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalogue' and can_manage_catalogue_file(name));

-- Public (no sign-in): only what the menu page shows.
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
    'menu_pdf_updated_at', b.menu_pdf_updated_at
  )
  from businesses b
  order by b.created_at
  limit 1;
$$;

revoke all on function get_public_menu() from public;
grant execute on function get_public_menu() to anon, authenticated;
