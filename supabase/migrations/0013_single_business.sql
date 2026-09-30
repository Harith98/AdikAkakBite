-- ============================================================================
-- 0013_single_business.sql
--
-- This deployment runs ONE business. After the owner's first-time setup,
-- nobody can create another: new people join only through an invitation.
--
--   * app_is_set_up() — has the business been created yet? Callable before
--     sign-in so the signup page knows whether to offer first-time setup.
--   * businesses may contain at most one row (unique index on a constant).
--   * the "any signed-in user can create a business" policy from 0003 is
--     replaced by one that only allows it while none exists.
-- ============================================================================

do $$
begin
  if (select count(*) from businesses) > 1 then
    raise exception
      'Found % businesses, but this app is now single-business. Delete the extra (test) businesses first, then re-run this migration.',
      (select count(*) from businesses);
  end if;
end;
$$;

create or replace function app_is_set_up()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from businesses);
$$;

comment on function app_is_set_up is 'True once the (single) business has been created. SECURITY DEFINER: callers can''t otherwise see businesses they don''t belong to.';

revoke all on function app_is_set_up() from public;
grant execute on function app_is_set_up() to anon, authenticated;

-- Hard guarantee: a second row can never be inserted, whatever the client.
create unique index businesses_single_row on businesses ((true));

drop policy if exists "authenticated users can create a business" on businesses;
create policy "first user can create the business"
  on businesses for insert
  with check (auth.uid() is not null and not app_is_set_up());
