-- ============================================================================
-- 0009_team_invitations.sql
--
-- Multi-user businesses: invitations, role-based team management, and
-- tighter write access to settings/schedule.
--
-- Also closes a hole in 0003: "members can manage membership for their
-- business" let ANY member insert/update/delete ANY membership row — so a
-- staff member could promote themselves to owner or remove the owner. That
-- policy is replaced with role-aware ones below.
--
-- Permission rules (mirrored in src/lib/team.ts for the UI):
--   owner  can invite / re-role / remove admins and staff
--   admin  can invite / re-role / remove staff only
--   staff  can't manage the team
--   nobody can change or remove an owner through the app
--   anyone except an owner can leave a business
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER for the same recursion reason as
-- is_business_member in 0003)
-- ----------------------------------------------------------------------------

create or replace function current_member_role(target_business_id uuid)
returns business_member_role
language sql
security definer
set search_path = public
stable
as $$
  select role from business_members
  where business_id = target_business_id and user_id = auth.uid();
$$;

comment on function current_member_role is 'The signed-in user''s role in the given business, or null if not a member.';

create or replace function can_manage_business(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(current_member_role(target_business_id) in ('owner', 'admin'), false);
$$;

comment on function can_manage_business is 'True for owners and admins: may edit business details, settings and the daily schedule.';

create or replace function can_manage_role(target_business_id uuid, target_role business_member_role)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case current_member_role(target_business_id)
    when 'owner' then target_role in ('admin', 'staff')
    when 'admin' then target_role = 'staff'
    else false
  end;
$$;

comment on function can_manage_role is 'True if the signed-in user may invite, assign, or remove members holding target_role.';

-- ----------------------------------------------------------------------------
-- business_members: role-aware update/delete; inserts only via the
-- first-owner policy (0004) or accept_business_invitation() below.
-- ----------------------------------------------------------------------------

drop policy if exists "members can manage membership for their business" on business_members;

create policy "managers can change member roles"
  on business_members for update
  using (can_manage_role(business_id, role))
  with check (can_manage_role(business_id, role));

create policy "managers can remove members and members can leave"
  on business_members for delete
  using (
    (user_id = auth.uid() and role <> 'owner')
    or can_manage_role(business_id, role)
  );

-- Only the role may ever be changed on an existing membership — never who
-- or which business it belongs to.
revoke update on business_members from anon, authenticated;
grant update (role) on business_members to authenticated;

-- ----------------------------------------------------------------------------
-- Business details, settings and the daily schedule: everyone can read,
-- only owners/admins can change.
-- ----------------------------------------------------------------------------

drop policy if exists "members can update their business" on businesses;
create policy "managers can update their business"
  on businesses for update
  using (can_manage_business(id))
  with check (can_manage_business(id));

drop policy if exists "members can manage their business settings" on business_settings;
create policy "managers can manage their business settings"
  on business_settings for all
  using (can_manage_business(business_id))
  with check (can_manage_business(business_id));

drop policy if exists "members can access their schedule_blocks" on schedule_blocks;
create policy "members can view their schedule_blocks"
  on schedule_blocks for select
  using (is_business_member(business_id));
create policy "managers can add schedule_blocks"
  on schedule_blocks for insert
  with check (can_manage_business(business_id));
create policy "managers can edit schedule_blocks"
  on schedule_blocks for update
  using (can_manage_business(business_id))
  with check (can_manage_business(business_id));
create policy "managers can delete schedule_blocks"
  on schedule_blocks for delete
  using (can_manage_business(business_id));

-- ----------------------------------------------------------------------------
-- Invitations
-- ----------------------------------------------------------------------------

create table business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) <= 200),
  role business_member_role not null default 'staff' check (role <> 'owner'),
  -- 244 random bits; the link itself is the credential, so it is only
  -- readable by the managers allowed to share it (see policies below).
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table business_invitations is 'Pending/used invite links. Accepting one (accept_business_invitation) creates the business_members row.';

create index idx_business_invitations_business_id on business_invitations(business_id);
-- At most one open invitation per email per business.
create unique index idx_business_invitations_open_email
  on business_invitations(business_id, email) where accepted_at is null;

create trigger set_updated_at before update on business_invitations
  for each row execute function set_updated_at();

alter table business_invitations enable row level security;

create policy "managers can view invitations they could send"
  on business_invitations for select
  using (can_manage_role(business_id, role));
create policy "managers can create invitations"
  on business_invitations for insert
  with check (can_manage_role(business_id, role) and invited_by = auth.uid());
create policy "managers can revoke invitations"
  on business_invitations for delete
  using (can_manage_role(business_id, role));

-- What the invite page shows before the person has signed in. Callable
-- without a session: knowing the (unguessable) token is the permission.
create or replace function get_invitation(p_token text)
returns table (business_name text, email text, role business_member_role, status text)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.name,
    i.email,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from business_invitations i
  join businesses b on b.id = i.business_id
  where i.token = p_token;
$$;

revoke all on function get_invitation(text) from public;
grant execute on function get_invitation(text) to anon, authenticated;

-- Turns an invitation into a membership for the signed-in user. SECURITY
-- DEFINER because the invitee isn't a member yet, so RLS would block both
-- reading the invitation and inserting their membership.
create or replace function accept_business_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv business_invitations;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;

  select * into inv from business_invitations where token = p_token for update;
  if not found then
    raise exception 'This invitation link is not valid.';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invitation has already been used.';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask for a new link.';
  end if;

  select lower(email) into caller_email from auth.users where id = auth.uid();
  if caller_email is distinct from inv.email then
    raise exception 'This invitation is for %. Sign in with that email to accept it.', inv.email;
  end if;

  -- V1 is one business per account (see getCurrentBusinessContext).
  if exists (select 1 from business_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a business. Use a different email for this invitation.';
  end if;

  insert into business_members (business_id, user_id, role)
  values (inv.business_id, auth.uid(), inv.role);

  update business_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = inv.id;

  insert into business_activity_logs (business_id, user_id, action, entity_type, entity_id, metadata)
  values (inv.business_id, auth.uid(), 'member_joined', 'business_member', auth.uid(), jsonb_build_object('role', inv.role));

  return inv.business_id;
end;
$$;

revoke all on function accept_business_invitation(text) from public;
grant execute on function accept_business_invitation(text) to authenticated;

-- Team list with emails. Emails live in auth.users, which the app can't
-- read directly; this returns them only to members of the same business.
create or replace function get_business_members(p_business_id uuid)
returns table (member_id uuid, user_id uuid, email text, role business_member_role, joined_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.user_id, u.email::text, m.role, m.created_at
  from business_members m
  join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
    and is_business_member(p_business_id)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

revoke all on function get_business_members(uuid) from public;
grant execute on function get_business_members(uuid) to authenticated;
