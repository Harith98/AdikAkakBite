-- ============================================================================
-- 0018_product_images.sql
--
-- Product photos in Supabase Storage. The app resizes photos in the browser
-- (max 1200px JPEG, usually 100–300 KB) and uploads them to the
-- `product-images` bucket at  <business_id>/<random>.jpg ; products.image_url
-- keeps the public URL, so no products column changes.
--
-- The bucket is public-read (the URLs are unguessable and the images are
-- meant to be shown, e.g. on receipts or shared later). Only members of the
-- business named by the first folder can upload, replace or delete.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the object's first folder is a business the signed-in user belongs to.
-- A folder that isn't a UUID simply doesn't match (no cast error).
create or replace function is_product_image_owner(object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from business_members m
    where m.user_id = auth.uid()
      and m.business_id::text = (storage.foldername(object_name))[1]
  );
$$;

create policy "members can read their product images"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and is_product_image_owner(name));

create policy "members can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and is_product_image_owner(name));

create policy "members can replace product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and is_product_image_owner(name));

create policy "members can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and is_product_image_owner(name));
