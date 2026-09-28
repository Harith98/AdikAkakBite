-- ============================================================================
-- 0003_rls_policies.sql
-- Row Level Security (spec §36, §54): a user must never be able to read or
-- write another business's data.
--
-- Pattern used throughout: a SECURITY DEFINER helper function
-- (is_business_member) checks business_members directly, bypassing RLS on
-- that one table only, inside a locked-down function. This avoids the
-- classic Postgres RLS recursion trap you get if a policy on
-- business_members queries business_members again through PostgREST's
-- normal (RLS-enforced) path.
-- ============================================================================

create or replace function is_business_member(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from business_members
    where business_id = target_business_id
      and user_id = auth.uid()
  );
$$;

comment on function is_business_member is
  'True if the current authenticated user belongs to the given business. SECURITY DEFINER so it can read business_members without triggering that table''s own RLS policy recursively.';

-- ----------------------------------------------------------------------------
-- businesses / business_members / business_settings
-- ----------------------------------------------------------------------------

alter table businesses enable row level security;

create policy "members can view their business"
  on businesses for select
  using (is_business_member(id));

create policy "members can update their business"
  on businesses for update
  using (is_business_member(id));

-- Insert has no business_id yet to check membership against, so it is
-- allowed for any authenticated user (this is how a new business gets
-- created during onboarding) — the *matching* business_members row is
-- created in the same transaction by the application, not by this policy.
create policy "authenticated users can create a business"
  on businesses for insert
  with check (auth.uid() is not null);

alter table business_members enable row level security;

create policy "members can view their own membership rows"
  on business_members for select
  using (user_id = auth.uid() or is_business_member(business_id));

create policy "members can manage membership for their business"
  on business_members for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table business_settings enable row level security;

create policy "members can view their business settings"
  on business_settings for select
  using (is_business_member(business_id));

create policy "members can manage their business settings"
  on business_settings for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- ----------------------------------------------------------------------------
-- Generic pattern for every remaining business-scoped table: members of a
-- business can select/insert/update/delete rows that belong to it, and
-- nothing else. Written out per-table (rather than dynamically) so each
-- policy is easy to read and audit individually.
-- ----------------------------------------------------------------------------

alter table schedule_blocks enable row level security;
create policy "members can access their schedule_blocks"
  on schedule_blocks for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table tasks enable row level security;
create policy "members can access their tasks"
  on tasks for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table customers enable row level security;
create policy "members can access their customers"
  on customers for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table products enable row level security;
create policy "members can access their products"
  on products for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- product_costs has no business_id column directly, so membership is
-- checked through its parent product.
alter table product_costs enable row level security;
create policy "members can access their product_costs"
  on product_costs for all
  using (
    exists (
      select 1 from products
      where products.id = product_costs.product_id
        and is_business_member(products.business_id)
    )
  )
  with check (
    exists (
      select 1 from products
      where products.id = product_costs.product_id
        and is_business_member(products.business_id)
    )
  );

alter table orders enable row level security;
create policy "members can access their orders"
  on orders for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table order_items enable row level security;
create policy "members can access their order_items"
  on order_items for all
  using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and is_business_member(orders.business_id)
    )
  )
  with check (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and is_business_member(orders.business_id)
    )
  );

alter table sales enable row level security;
create policy "members can access their sales"
  on sales for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table inventory_items enable row level security;
create policy "members can access their inventory_items"
  on inventory_items for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table inventory_transactions enable row level security;
create policy "members can access their inventory_transactions"
  on inventory_transactions for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table content_items enable row level security;
create policy "members can access their content_items"
  on content_items for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table goals enable row level security;
create policy "members can access their goals"
  on goals for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

alter table daily_reviews enable row level security;
create policy "members can access their daily_reviews"
  on daily_reviews for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- Activity logs are append-only from the application's point of view:
-- members can read and insert, but not edit or delete history.
alter table business_activity_logs enable row level security;
create policy "members can view their activity logs"
  on business_activity_logs for select
  using (is_business_member(business_id));
create policy "members can create activity log entries"
  on business_activity_logs for insert
  with check (is_business_member(business_id));
