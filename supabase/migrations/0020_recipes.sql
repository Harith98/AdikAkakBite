-- ============================================================================
-- 0020_recipes.sql
--
-- Recipes: which inventory items (ingredients, packaging) a product uses.
--
--   products.recipe_yield    how many units one batch of the recipe makes
--   product_recipe_items     amount of each inventory item one BATCH uses,
--                            in that item's own unit (0.25 for 250 g if the
--                            item is stocked in kg)
--
-- Ingredients come off inventory when the product is MADE:
--   * stock-tracked products (ready_stock not null): when a batch is added to
--     ready stock (the app calls use_recipe_ingredients);
--   * made-to-order products (ready_stock null): when their order is
--     completed (trigger below). Moving the order out of "completed" undoes
--     exactly those usage records.
-- Usage is logged as normal inventory_transactions (type 'usage'), so the
-- inventory history and forecasts see it like any other usage.
-- ============================================================================

alter table products
  add column recipe_yield integer not null default 1,
  add constraint products_recipe_yield_positive check (recipe_yield > 0);

comment on column products.recipe_yield is 'Units one batch of the recipe makes (product_recipe_items amounts are per batch).';

create table product_recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  quantity numeric(12,3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_recipe_items_quantity_positive check (quantity > 0),
  constraint product_recipe_items_unique unique (product_id, inventory_item_id)
);

create index idx_product_recipe_items_item on product_recipe_items(inventory_item_id);

create trigger trg_product_recipe_items_updated_at
  before update on product_recipe_items
  for each row execute function set_updated_at();

alter table product_recipe_items enable row level security;

-- Same pattern as product_costs: access follows the parent product's business.
create policy "members can access their recipe items"
  on product_recipe_items for all
  using (exists (select 1 from products where products.id = product_recipe_items.product_id and is_business_member(products.business_id)))
  with check (exists (select 1 from products where products.id = product_recipe_items.product_id and is_business_member(products.business_id)));

-- Takes the ingredients for `p_units` units of a product out of inventory.
-- SECURITY INVOKER: runs with the caller's rights, so RLS still applies.
create or replace function use_recipe_ingredients(p_product_id uuid, p_units numeric, p_reference text, p_date date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product products;
  v_line record;
  v_count integer := 0;
begin
  if p_units <= 0 then
    return 0;
  end if;
  select * into v_product from products where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;

  for v_line in
    select r.inventory_item_id, r.quantity, i.unit
    from product_recipe_items r
    join inventory_items i on i.id = r.inventory_item_id
    where r.product_id = p_product_id
  loop
    perform record_inventory_transaction(
      v_product.business_id,
      v_line.inventory_item_id,
      round(v_line.quantity * p_units / v_product.recipe_yield, 3),
      v_line.unit,
      'usage',
      p_date,
      p_reference,
      'Recipe: ' || v_product.name || ' × ' || trim_scale(p_units)::text
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function use_recipe_ingredients(uuid, numeric, text, date) from public;
grant execute on function use_recipe_ingredients(uuid, numeric, text, date) to authenticated;

-- Extends 0017's order trigger: made-to-order products use their ingredients
-- when the order completes, and get them back if it's un-completed.
create or replace function apply_order_ready_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sign integer;
  v_item record;
  v_reference text := 'order:' || new.id;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    v_sign := -1;
  elsif old.status = 'completed' and new.status is distinct from 'completed' then
    v_sign := 1;
  else
    return new;
  end if;

  -- Ready stock (0017): tracked products only.
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
    and p.ready_stock is not null;

  if v_sign = -1 then
    -- Made-to-order products: ingredients are used now.
    for v_item in
      select oi.product_id, sum(oi.quantity) as quantity
      from order_items oi
      join products p on p.id = oi.product_id
      where oi.order_id = new.id and p.ready_stock is null and p.business_id = new.business_id
      group by oi.product_id
    loop
      perform use_recipe_ingredients(v_item.product_id, v_item.quantity, v_reference, coalesce(new.completed_on, current_date));
    end loop;
  else
    -- Un-completed: put back exactly what this order used, and remove those records.
    update inventory_items i
    set current_quantity = i.current_quantity + used.quantity
    from (
      select inventory_item_id, sum(quantity) as quantity
      from inventory_transactions
      where business_id = new.business_id and reference = v_reference and transaction_type = 'usage'
      group by inventory_item_id
    ) used
    where i.id = used.inventory_item_id;

    delete from inventory_transactions
    where business_id = new.business_id and reference = v_reference and transaction_type = 'usage';
  end if;

  return new;
end;
$$;
