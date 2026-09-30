-- ============================================================================
-- 0015_order_completed_on.sql
--
-- Sales count on the day an order is COMPLETED, not the day it was taken.
-- Before this, an order taken on 1 Oct for 1 Dec added to October's sales
-- when it was completed in December, and never showed in December's.
--
-- completed_on is set by a trigger, in the business's own timezone, so it's
-- right whichever screen or client completes the order. Un-completing an
-- order clears it; completing it again sets the new day.
--
-- Orders completed before this migration are backfilled with their
-- order_date, so past sales totals don't change.
-- ============================================================================

alter table orders add column completed_on date;

comment on column orders.completed_on is 'Business-local date the order was marked completed (set by trigger). Sales totals are grouped by this.';

update orders set completed_on = order_date where status = 'completed';

create or replace function set_order_completed_on()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' or new.completed_on is null then
      new.completed_on := (
        now() at time zone coalesce(
          (select timezone from business_settings where business_id = new.business_id),
          'Asia/Kuala_Lumpur'
        )
      )::date;
    else
      new.completed_on := old.completed_on; -- editing a completed order keeps its sales day
    end if;
  else
    new.completed_on := null;
  end if;
  return new;
end;
$$;

create trigger trg_orders_completed_on
  before insert or update on orders
  for each row execute function set_order_completed_on();

create index idx_orders_completed_on on orders(business_id, completed_on) where status = 'completed';
