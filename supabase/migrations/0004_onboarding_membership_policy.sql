-- ============================================================================
-- 0004_onboarding_membership_policy.sql
--
-- Fixes a bootstrapping gap in 0003: the existing business_members policy
-- requires you to already be a member, so the very first owner of a brand-new
-- business could never insert their own membership row during onboarding.
--
-- This policy lets an authenticated user add THEMSELVES as a member of a
-- business only when that business has no members yet. Once the first owner
-- exists, this policy no longer matches, so nobody can add themselves to
-- someone else's business. Further members are added through the existing
-- "members can manage membership" policy by an existing member.
-- ============================================================================

create or replace function business_has_members(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from business_members where business_id = target_business_id
  );
$$;

comment on function business_has_members is
  'True if the business already has at least one member. SECURITY DEFINER so it can check regardless of the caller''s RLS visibility.';

create policy "user can add themselves as first owner"
  on business_members for insert
  with check (
    user_id = auth.uid()
    and not business_has_members(business_id)
  );
