-- ============================================================================
-- 0007_inventory_transactions_rpc.sql  (Phase 3B)
--
-- record_inventory_transaction(): logs a transaction AND updates the item's
-- current_quantity in one round trip, with the row locked for the duration
-- (SELECT ... FOR UPDATE), so two transactions logged at the same moment
-- can't race and silently drop one of them.
--
-- Runs as SECURITY INVOKER (the default — stated explicitly for clarity), so
-- it executes with the CALLER's privileges and is still subject to Row Level
-- Security on both tables. A user can only call this for a business they
-- belong to, exactly as if they'd run the two statements themselves.
--
-- Quantity meaning depends on type:
--   purchase → current_quantity increases by p_quantity
--   usage / waste → current_quantity decreases by p_quantity
--   adjustment → current_quantity is SET to p_quantity (a stock count correction)
-- current_quantity is never allowed below zero.
-- ============================================================================

create or replace function record_inventory_transaction(
  p_business_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_unit text,
  p_transaction_type inventory_transaction_type,
  p_transaction_date date,
  p_reference text,
  p_notes text
)
returns inventory_items
language plpgsql
security invoker
as $$
declare
  v_item inventory_items;
  v_new_quantity numeric;
begin
  if p_quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  select * into v_item
  from inventory_items
  where id = p_inventory_item_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  v_new_quantity := case p_transaction_type
    when 'adjustment' then p_quantity
    when 'purchase' then v_item.current_quantity + p_quantity
    else v_item.current_quantity - p_quantity -- usage or waste
  end;

  if v_new_quantity < 0 then
    v_new_quantity := 0;
  end if;

  insert into inventory_transactions (
    business_id, inventory_item_id, quantity, unit, transaction_type, transaction_date, reference, notes
  ) values (
    p_business_id, p_inventory_item_id, p_quantity, p_unit, p_transaction_type, p_transaction_date, p_reference, p_notes
  );

  update inventory_items set current_quantity = v_new_quantity where id = p_inventory_item_id;

  select * into v_item from inventory_items where id = p_inventory_item_id;
  return v_item;
end;
$$;

comment on function record_inventory_transaction is
  'Atomically logs an inventory transaction and updates current_quantity. See spec §18-19. Called via supabase.rpc() from src/lib/services/inventory.ts.';
