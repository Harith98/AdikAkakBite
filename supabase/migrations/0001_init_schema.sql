-- ============================================================================
-- 0001_init_schema.sql
-- Dessert OS — core schema (Phase 1: Foundation)
--
-- Design notes:
--   * Every business-owned table carries business_id (multi-tenancy, spec §36).
--   * UUID primary keys everywhere, generated with gen_random_uuid() (pgcrypto).
--   * created_at / updated_at on every table; updated_at is kept current by a
--     shared trigger (see bottom of file) rather than by application code, so
--     it stays correct no matter which client writes the row.
--   * Money is stored as numeric(12,2) in the business's own currency — no
--     multi-currency conversion in V1 (spec keeps this simple: one currency
--     per business, default MYR).
--   * This migration only creates tables, types and triggers. Row Level
--     Security policies live in 0002_rls_policies.sql so the two concerns
--     stay easy to review independently. Indexes live in 0003_indexes.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Shared enum types
-- ----------------------------------------------------------------------------

create type business_member_role as enum ('owner', 'staff');

create type task_status as enum ('not_started', 'in_progress', 'paused', 'completed', 'skipped');
create type task_category as enum (
  'orders', 'production', 'marketing', 'content', 'sales',
  'customers', 'inventory', 'product_development', 'business',
  'cleaning', 'administration'
);
create type task_source as enum ('manual', 'schedule', 'system_recommendation');

create type order_status as enum ('new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');
create type payment_status as enum ('unpaid', 'deposit_paid', 'fully_paid');

create type inventory_status as enum ('ok', 'low', 'reorder', 'out_of_stock');
create type inventory_transaction_type as enum ('purchase', 'usage', 'waste', 'adjustment');

create type content_platform as enum ('instagram', 'tiktok', 'facebook', 'whatsapp', 'other');
create type content_type as enum (
  'product_photo', 'reel', 'tiktok', 'behind_the_scenes',
  'customer_review', 'educational', 'promotion', 'story'
);
create type content_status as enum ('idea', 'planned', 'filming', 'editing', 'ready', 'posted');

create type goal_metric as enum (
  'weekly_revenue', 'monthly_revenue', 'orders', 'new_customers',
  'repeat_customers', 'content_posts', 'new_products', 'waste_reduction'
);
create type goal_status as enum ('on_track', 'behind', 'achieved', 'missed', 'not_started');

-- ----------------------------------------------------------------------------
-- businesses / business_members / business_settings
-- ----------------------------------------------------------------------------

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table businesses is 'One row per tenant. Everything else hangs off business_id.';

create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role business_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);
comment on table business_members is 'Links Supabase auth users to the business(es) they can access. A V1 business will typically have exactly one owner member.';

create table business_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  currency text not null default 'MYR',
  timezone text not null default 'Asia/Kuala_Lumpur',
  working_hours_start time not null default '11:00',
  working_hours_end time not null default '20:00',
  -- ISO 8601 weekday numbers (1 = Monday .. 7 = Sunday) the business normally operates.
  working_days smallint[] not null default '{1,2,3,4,5,6,7}',
  notification_preferences jsonb not null default '{}'::jsonb,
  forecast_settings jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  onboarding_step smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- schedule_blocks — the editable default daily schedule (spec §8)
-- ----------------------------------------------------------------------------

create table schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  category task_category not null,
  start_time time not null,
  end_time time not null,
  -- Default suggested tasks shown when this block becomes active; the owner
  -- can still add/skip individual tasks for the day without editing the block.
  default_tasks text[] not null default '{}',
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_block_time_order check (end_time > start_time)
);

-- ----------------------------------------------------------------------------
-- tasks
-- ----------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  description text,
  category task_category not null,
  priority smallint not null default 0, -- higher = more important; used by the recommendation engine
  estimated_duration_minutes integer,
  scheduled_date date,
  scheduled_time time,
  status task_status not null default 'not_started',
  is_recurring boolean not null default false,
  source task_source not null default 'manual',
  schedule_block_id uuid references schedule_blocks(id) on delete set null,
  order_id uuid, -- FK added after orders table exists, see below
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table customers is 'first_order_date, last_order_date, number_of_orders and total_spending are derived from orders at query time (see getCustomerMetrics service) rather than duplicated here, so they can never drift out of sync.';

-- ----------------------------------------------------------------------------
-- products / product_costs
-- ----------------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category text,
  description text,
  selling_price numeric(12,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_selling_price_non_negative check (selling_price >= 0)
);

-- product_costs is kept as its own table (rather than columns on products) so
-- that cost changes over time are preserved for historical margin accuracy;
-- the *current* cost is the row with effective_to is null.
create table product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  ingredient_cost numeric(12,2) not null default 0,
  packaging_cost numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  constraint product_costs_non_negative check (
    ingredient_cost >= 0 and packaging_cost >= 0 and other_cost >= 0
  )
);
comment on table product_costs is 'total_cost, gross_profit and gross_margin are derived, never stored: total_cost = ingredient_cost + packaging_cost + other_cost; gross_profit = selling_price - total_cost; gross_margin = gross_profit / selling_price * 100.';

-- ----------------------------------------------------------------------------
-- orders / order_items
-- ----------------------------------------------------------------------------

create table orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  order_date date not null default current_date,
  required_date date,
  required_time time,
  discount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  payment_status payment_status not null default 'unpaid',
  status order_status not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_non_negative check (discount >= 0 and delivery_fee >= 0 and deposit >= 0)
);
comment on table orders is 'total and balance are derived from order_items + discount/delivery_fee/deposit (see getOrderTotals in the orders service), not stored, so they can never disagree with their line items.';

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  -- product_name/unit_price are snapshotted at order time so historical
  -- orders still make sense after a product is renamed, repriced or deleted.
  product_name text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_non_negative check (unit_price >= 0)
);

alter table tasks
  add constraint tasks_order_id_fkey foreign key (order_id) references orders(id) on delete set null;

-- ----------------------------------------------------------------------------
-- sales — daily rollup rows, one per business per date (spec §20)
-- ----------------------------------------------------------------------------

create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  sale_date date not null,
  revenue numeric(12,2) not null default 0,
  order_count integer not null default 0,
  discounts numeric(12,2) not null default 0,
  delivery_fees numeric(12,2) not null default 0,
  waste_value numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sale_date)
);
comment on table sales is 'A daily summary row, typically populated by the Closing schedule block (spec §8) and/or derived automatically from completed orders. Per-product sales come from order_items joined through orders, not duplicated here.';

-- ----------------------------------------------------------------------------
-- inventory_items / inventory_transactions
-- ----------------------------------------------------------------------------

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category text,
  current_quantity numeric(12,3) not null default 0,
  unit text not null,
  reorder_level numeric(12,3) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  supplier text,
  expiry_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_non_negative check (current_quantity >= 0 and reorder_level >= 0)
);
comment on table inventory_items is 'status (ok/low/reorder/out_of_stock) is derived from current_quantity vs reorder_level at query time — see getInventoryStatus — not stored as a column, so it is always consistent with the live quantity.';

create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  quantity numeric(12,3) not null,
  unit text not null,
  transaction_type inventory_transaction_type not null,
  transaction_date date not null default current_date,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);
comment on table inventory_transactions is 'The historical record used by getInventoryForecast (moving-average days-remaining calculation, spec §19).';

-- ----------------------------------------------------------------------------
-- content_items (spec §26)
-- ----------------------------------------------------------------------------

create table content_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  content_date date not null default current_date,
  platform content_platform not null,
  content_type content_type not null,
  product_id uuid references products(id) on delete set null,
  idea text,
  caption text,
  status content_status not null default 'idea',
  published_url text,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- goals (spec §28)
-- ----------------------------------------------------------------------------

create table goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  metric goal_metric not null,
  target numeric(12,2) not null,
  start_date date not null,
  end_date date not null,
  status goal_status not null default 'not_started',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_date_order check (end_date >= start_date)
);
comment on table goals is 'current_value and progress_percent are computed by getBusinessGoals from the relevant source table (sales/orders/customers/content_items) for the metric + date range, not stored, so progress is always live.';

-- ----------------------------------------------------------------------------
-- daily_reviews — the Closing block's end-of-day record (spec §8, §61)
-- ----------------------------------------------------------------------------

create table daily_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  review_date date not null,
  revenue numeric(12,2),
  orders_count integer,
  waste_value numeric(12,2),
  unfinished_tasks_note text,
  tomorrow_prep_note text,
  improvement_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, review_date)
);

-- ----------------------------------------------------------------------------
-- business_activity_logs (spec §48)
-- ----------------------------------------------------------------------------

create table business_activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table business_activity_logs is 'Append-only. Written by application code whenever a significant action happens (order created, task completed, etc.) — see spec §48 for the full list.';

-- ----------------------------------------------------------------------------
-- updated_at trigger, applied to every table that has the column
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function set_updated_at();',
      t
    );
  end loop;
end;
$$;
