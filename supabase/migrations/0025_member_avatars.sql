-- ============================================================================
-- 0025_member_avatars.sql
--
-- get_business_members() also returns each member's profile photo
-- (avatar_url in their auth metadata, set by them in Settings → Your account,
-- migration 0024), so the Team page can show everyone's photo.
-- Only https links are passed through.
--
-- The return type changes, so the function is dropped and recreated.
-- ============================================================================

drop function if exists get_business_members(uuid);

create function get_business_members(p_business_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  role business_member_role,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.user_id,
    u.email::text,
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    case when u.raw_user_meta_data ->> 'avatar_url' like 'https://%' then u.raw_user_meta_data ->> 'avatar_url' end,
    m.role,
    m.created_at
  from business_members m
  join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
    and is_business_member(p_business_id)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

revoke all on function get_business_members(uuid) from public;
grant execute on function get_business_members(uuid) to authenticated;
