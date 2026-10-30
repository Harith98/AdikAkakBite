-- ============================================================================
-- 2026-10-30_atomic_saves.sql — schema version 7 → 8
--
-- All-or-nothing saves, so a dropped connection or an error half-way can never
-- leave wrong data behind:
--   create_order_with_items()  the order and its items together
--   update_order_with_items()  edit an order: its details AND items swapped
--                              in one go (before, a failure part-way could
--                              leave the old and new items both, doubling
--                              the total)
--   save_recipe()              a product's batch size and ingredients
--
-- SECURITY INVOKER: they run as the signed-in person, so Row Level Security
-- still decides what they can touch. Each function is one transaction.
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_device_names.sql). Safe to run again.
-- ============================================================================

create or replace function create_order_with_items(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := coalesce((p_order ->> 'id')::uuid, gen_random_uuid());
begin
  insert into orders (
    id, business_id, customer_id, order_date, required_date, required_time,
    discount, delivery_fee, deposit, payment_status, status, completed_on, notes
  ) values (
    v_id,
    (p_order ->> 'business_id')::uuid,
    (p_order ->> 'customer_id')::uuid,
    coalesce((p_order ->> 'order_date')::date, current_date),
    (p_order ->> 'required_date')::date,
    (p_order ->> 'required_time')::time,
    coalesce((p_order ->> 'discount')::numeric, 0),
    coalesce((p_order ->> 'delivery_fee')::numeric, 0),
    coalesce((p_order ->> 'deposit')::numeric, 0),
    coalesce((p_order ->> 'payment_status')::payment_status, 'unpaid'),
    coalesce((p_order ->> 'status')::order_status, 'new'),
    (p_order ->> 'completed_on')::date,
    p_order ->> 'notes'
  );

  insert into order_items (order_id, product_id, product_name, quantity, unit_price)
  select v_id, (i ->> 'product_id')::uuid, i ->> 'product_name', (i ->> 'quantity')::integer, (i ->> 'unit_price')::numeric
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i;

  return v_id;
end;
$$;

revoke all on function create_order_with_items(jsonb, jsonb) from public;
grant execute on function create_order_with_items(jsonb, jsonb) to authenticated;

create or replace function update_order_with_items(p_order_id uuid, p_business_id uuid, p_fields jsonb, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update orders set
    customer_id = (p_fields ->> 'customer_id')::uuid,
    required_date = (p_fields ->> 'required_date')::date,
    required_time = (p_fields ->> 'required_time')::time,
    discount = coalesce((p_fields ->> 'discount')::numeric, 0),
    delivery_fee = coalesce((p_fields ->> 'delivery_fee')::numeric, 0),
    deposit = coalesce((p_fields ->> 'deposit')::numeric, 0),
    payment_status = coalesce((p_fields ->> 'payment_status')::payment_status, payment_status),
    notes = p_fields ->> 'notes'
  where id = p_order_id and business_id = p_business_id;
  if not found then
    raise exception 'That order could not be found.';
  end if;

  delete from order_items where order_id = p_order_id;
  insert into order_items (order_id, product_id, product_name, quantity, unit_price)
  select p_order_id, (i ->> 'product_id')::uuid, i ->> 'product_name', (i ->> 'quantity')::integer, (i ->> 'unit_price')::numeric
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i;
end;
$$;

revoke all on function update_order_with_items(uuid, uuid, jsonb, jsonb) from public;
grant execute on function update_order_with_items(uuid, uuid, jsonb, jsonb) to authenticated;

create or replace function save_recipe(p_product_id uuid, p_business_id uuid, p_yield integer, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update products set recipe_yield = p_yield where id = p_product_id and business_id = p_business_id;
  if not found then
    raise exception 'That product could not be found.';
  end if;

  delete from product_recipe_items where product_id = p_product_id;
  insert into product_recipe_items (product_id, inventory_item_id, quantity)
  select p_product_id, (i ->> 'inventory_item_id')::uuid, (i ->> 'quantity')::numeric
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i;
end;
$$;

revoke all on function save_recipe(uuid, uuid, integer, jsonb) from public;
grant execute on function save_recipe(uuid, uuid, integer, jsonb) to authenticated;

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 8;
$$;

select schema_version() as schema_version; -- should say 8
