-- ============================================================================
-- 0010_transfer_ownership.sql
--
-- transfer_business_ownership(): the current owner hands ownership to an
-- existing member of the same business. The new owner becomes 'owner' and
-- the previous owner becomes 'admin', in one statement-pair inside one
-- transaction, so the business always has exactly one owner.
--
-- SECURITY DEFINER because 0009's policies deliberately forbid anyone from
-- setting or changing an 'owner' role directly; this function is the one
-- sanctioned path, and it does its own authorization check.
-- ============================================================================

create or replace function transfer_business_ownership(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target business_members;
  caller business_members;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;

  select * into target from business_members where id = p_member_id for update;
  if not found then
    raise exception 'That team member could not be found.';
  end if;

  select * into caller
  from business_members
  where business_id = target.business_id and user_id = auth.uid()
  for update;
  if not found or caller.role <> 'owner' then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if target.id = caller.id then
    raise exception 'You are already the owner.';
  end if;

  update business_members set role = 'admin' where id = caller.id;
  update business_members set role = 'owner' where id = target.id;

  insert into business_activity_logs (business_id, user_id, action, entity_type, entity_id, metadata)
  values (
    target.business_id, auth.uid(), 'ownership_transferred', 'business_member', target.user_id,
    jsonb_build_object('from_user_id', caller.user_id, 'to_user_id', target.user_id)
  );
end;
$$;

revoke all on function transfer_business_ownership(uuid) from public;
grant execute on function transfer_business_ownership(uuid) to authenticated;
