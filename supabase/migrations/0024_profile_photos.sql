-- ============================================================================
-- 0024_profile_photos.sql
--
-- Profile photos (Settings → Your account). The app shrinks the photo to a
-- 400px square JPEG in the browser and uploads it to the `avatars` bucket at
-- <user id>/<random>.jpg. Its public URL is kept in the person's own auth
-- metadata (avatar_url), next to display_name, so no table changes.
-- Each person can only upload or delete files in their own folder.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "people can read their own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "people can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "people can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
