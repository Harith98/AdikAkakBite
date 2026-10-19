-- ============================================================================
-- 0017_product_ready_stock.sql
--
-- Ready stock: how many finished units of a product are on hand (baked,
-- packed, ready to hand over). Separate from inventory_items, which are
-- ingredients and packaging.
--
--   products.ready_stock  null = not tracked (made to order); a number = tracked.
--   It may go below zero: that means more were sold than were recorded as
--   ready, and the app shows it as "short by N" instead of hiding it.
--
-- Completing an order takes its items out of ready stock; moving an order
-- out of "completed" (back to ready, or cancelled) puts them back. Done in a
-- trigger so it holds whichever screen changes the status. Editing the items
-- of an order that is already completed does not change stock.
-- ============================================================================

alter table products add column ready_stock integer;

comment on column products.ready_stock is 'Finished units on hand. Null = not tracked. Reduced when an order completes (trigger on orders).';

-- Atomic +/- so two people adjusting at once can't overwrite each other.
-- SECURITY INVOKER: RLS on products still decides who may change what.
create or replace function adjust_product_ready_stock(p_product_id uuid, p_change integer)
returns integer
language sql
security invoker
set search_path = public
as $$
  update products
  set ready_stock = coalesce(ready_stock, 0) + p_change
  where id = p_product_id
  returning ready_stock;
$$;

revoke all on function adjust_product_ready_stock(uuid, integer) from public;
grant execute on function adjust_product_ready_stock(uuid, integer) to authenticated;

create or replace function apply_order_ready_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sign integer;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    v_sign := -1; -- sold: out of ready stock
  elsif old.status = 'completed' and new.status is distinct from 'completed' then
    v_sign := 1;  -- un-completed or cancelled: back into ready stock
  else
    return new;
  end if;

  update products p
  set ready_stock = p.ready_stock + v_sign * items.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from order_items
    where order_id = new.id and product_id is not null
    group by product_id
  ) items
  where p.id = items.product_id
    and p.business_id = new.business_id
    and p.ready_stock is not null; -- untracked products are left alone

  return new;
end;
$$;

create trigger trg_orders_ready_stock
  after update of status on orders
  for each row execute function apply_order_ready_stock();
