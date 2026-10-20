-- ============================================================================
-- schema.sql — the whole AdikAkak Bites database, in one file
--
-- For a NEW Supabase project: open SQL Editor, paste this file, Run. Then
-- start the app, sign up and finish first-time setup.
--
-- Do NOT run this on a database that is already set up. Changes to an existing
-- database go in a small file in supabase/updates/ (see docs/database.md), and
-- the same change is made here too, so this file always describes today's schema.
--
-- Sections:
--    1. Types
--    2. Tables
--    3. Indexes
--    4. updated_at trigger
--    5. Access helpers (who may do what)
--    6. App functions (team, inventory, receipts, ready stock, recipes, menu, status)
--    7. Order triggers
--    8. Row Level Security
--    9. Storage buckets (product photos, catalogue PDF, profile photos)
--
-- Design notes:
--   * Every business-owned table carries business_id; RLS checks membership.
--   * UUID primary keys, generated with gen_random_uuid() (pgcrypto).
--   * created_at / updated_at on every table; updated_at is kept current by a
--     shared trigger, so it is right whichever client writes the row.
--   * Money is numeric(12,2) in the business's own currency (default MYR).
--   * Values that can be computed (order totals, customer spending, stock
--     status, margins) are computed by the app, never stored.
-- ============================================================================

create extension if not exists "pgcrypto";


-- ============================================================================
-- 1. Types
-- ============================================================================

--   owner — everything, including managing admins
--   admin — business settings, daily schedule, and managing staff
--   staff — day-to-day work (Today, orders, products, inventory, customers, sales)
create type business_member_role as enum ('owner', 'admin', 'staff');

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


-- ============================================================================
-- 2. Tables
-- ============================================================================

-- ---- businesses / members / settings ---------------------------------------

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  -- Contact details printed on receipts.
  phone text check (length(phone) <= 30),
  email text check (length(email) <= 200),
  address text check (length(address) <= 300),
  registration_number text check (length(registration_number) <= 50),
  receipt_footer text check (length(receipt_footer) <= 300),
  -- Customer menu (/menu): the current PDF catalogue.
  menu_pdf_url text,
  menu_pdf_updated_at timestamptz,
  -- Social pages, stored as full https links (the app turns "@handle" into a link).
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  threads_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table businesses is 'The shop. This deployment runs exactly one business (see businesses_single_row).';
comment on column businesses.registration_number is 'Company/SSM registration number, printed on receipts if set.';
comment on column businesses.receipt_footer is 'Custom closing line on receipts, e.g. a thank-you or return policy.';

create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role business_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);
comment on table business_members is 'Links Supabase auth users to the business. Each person''s own name and photo live in their auth metadata (display_name, avatar_url).';

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

-- ---- daily schedule and tasks ----------------------------------------------

create table schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  category task_category not null,
  start_time time not null,
  end_time time not null,
  -- Tasks created for this block each day it's active.
  default_tasks text[] not null default '{}',
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_block_time_order check (end_time > start_time)
);

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
  order_id uuid, -- foreign key added after orders exists, below
  notes text,
  completed_at timestamptz,
  -- One of "today's three priorities" (1–3); at most one task per rank per day.
  daily_priority_rank smallint,
  -- Stable ordering of tasks inside a schedule block.
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_daily_priority_rank_range
    check (daily_priority_rank is null or daily_priority_rank between 1 and 3)
);

-- ---- customers -------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  -- The phone reduced to a comparable form, so "012-345 6789", "+60 12 345 6789"
  -- and "0060123456789" all become "60123456789". MUST stay identical to
  -- normalizePhone() in src/lib/customer-identity.ts. Deliberately not unique.
  phone_key text generated always as (
    nullif(
      case
        when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '00%'
          then substr(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 3)
        when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '0%'
          then '60' || substr(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 2)
        else regexp_replace(coalesce(phone, ''), '\D', '', 'g')
      end,
      ''
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table customers is 'first_order_date, last_order_date, number_of_orders and total_spending are derived from orders at query time (see getCustomerMetrics service) rather than duplicated here, so they can never drift out of sync.';
comment on column customers.phone_key is 'Normalised phone (digits, Malaysian 0… → 60…) used to identify customers. Generated from phone.';

-- ---- products --------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category text,
  description text,
  selling_price numeric(12,2) not null default 0,
  image_url text, -- public URL in the product-images bucket
  is_active boolean not null default true,
  notes text,
  ready_stock integer,
  recipe_yield integer not null default 1,
  nicknames text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_selling_price_non_negative check (selling_price >= 0),
  constraint products_recipe_yield_positive check (recipe_yield > 0)
);
comment on column products.ready_stock is 'Finished units on hand. Null = not tracked. Reduced when an order completes (trigger on orders).';
comment on column products.recipe_yield is 'Units one batch of the recipe makes (product_recipe_items amounts are per batch).';
comment on column products.nicknames is 'Other names customers use; matched by the WhatsApp paste reader.';

-- A separate table (not columns on products) so cost changes keep history for
-- margin accuracy; the current cost is the row with effective_to is null.
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

-- ---- orders ----------------------------------------------------------------

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
  -- Receipts: a per-business sequence, assigned once and never reused.
  receipt_number integer check (receipt_number > 0),
  receipt_issued_at timestamptz,
  payment_method text check (
    payment_method in ('cash', 'bank_transfer', 'duitnow_qr', 'card', 'ewallet', 'other')
  ),
  completed_on date,
  due_reminder_sent_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_non_negative check (discount >= 0 and delivery_fee >= 0 and deposit >= 0)
);
comment on table orders is 'total and balance are derived from order_items + discount/delivery_fee/deposit (see getOrderTotals in the orders service), not stored, so they can never disagree with their line items.';
comment on column orders.completed_on is 'Business-local date the order was marked completed (set by trigger). Sales totals are grouped by this.';
comment on column orders.due_reminder_sent_for is 'required_date the "due in 2 days" push reminder was sent for (null = not yet).';

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

-- ---- sales -----------------------------------------------------------------

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
comment on table sales is 'Not used by the app yet: sales figures are computed live from completed orders (orders.completed_on).';

-- ---- inventory -------------------------------------------------------------

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
  reference text, -- e.g. 'order:<id>' for ingredients a completed order used
  notes text,
  created_at timestamptz not null default now()
);
comment on table inventory_transactions is 'Stock history: purchases, usage, waste and counts. Used by the inventory forecast.';

-- Recipes: amount of each inventory item one BATCH of a product uses, in that
-- item's own unit (0.25 for 250 g if the item is stocked in kg).
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

-- ---- content, goals, daily closes, activity log ----------------------------

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
comment on table goals is 'current_value and progress_percent are computed from the relevant source table for the metric + date range, not stored.';

-- End-of-day records. The app no longer writes new ones; waste recorded in
-- earlier closes still shows in the monthly sales report.
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
comment on table business_activity_logs is 'Append-only. Written by the app when something significant happens (order created, task completed, daily jobs ran, etc.).';

-- ---- team invitations (kept for invite links; the app now adds staff directly)

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

-- ---- phone notifications (web push) ----------------------------------------

-- One row per device that turned notifications on. The endpoint is unique per
-- browser install; signing in as someone else on the same phone moves the row.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which notifications each person wants. No row means "all on".
create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  low_stock boolean not null default true,
  order_due boolean not null default true,
  schedule_change boolean not null default true,
  posting_reminder boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- Hard guarantee of one business: a second row can never be inserted.
create unique index businesses_single_row on businesses ((true));

create index idx_business_members_business_id on business_members(business_id);
create index idx_business_members_user_id on business_members(user_id);

create index idx_schedule_blocks_business_id on schedule_blocks(business_id);

create index idx_tasks_business_id on tasks(business_id);
create index idx_tasks_status on tasks(business_id, status);
create index idx_tasks_scheduled_date on tasks(business_id, scheduled_date);
create index idx_tasks_order_id on tasks(order_id) where order_id is not null;
create unique index uq_tasks_daily_priority
  on tasks (business_id, scheduled_date, daily_priority_rank)
  where daily_priority_rank is not null;
-- Makes creating each day's schedule tasks idempotent, even if two requests
-- race. Not partial, so PostgREST's upsert (ON CONFLICT) can target it; manual
-- tasks have a null schedule_block_id and nulls never conflict.
create unique index uq_tasks_schedule_materialization
  on tasks (business_id, scheduled_date, schedule_block_id, title);

create index idx_customers_business_id on customers(business_id);
create index idx_customers_business_name on customers (business_id, lower(name));
create index idx_customers_phone_key on customers(business_id, phone_key) where phone_key is not null;

create index idx_products_business_id on products(business_id);
create index idx_products_active on products(business_id, is_active);

create index idx_product_costs_product_id on product_costs(product_id);
create index idx_product_costs_current on product_costs(product_id) where effective_to is null;

create index idx_product_recipe_items_item on product_recipe_items(inventory_item_id);

create index idx_orders_business_id on orders(business_id);
create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_required_date on orders(business_id, required_date);
create index idx_orders_status on orders(business_id, status);
create unique index idx_orders_receipt_number
  on orders(business_id, receipt_number) where receipt_number is not null;
create index idx_orders_completed_on on orders(business_id, completed_on) where status = 'completed';

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_product_id on order_items(product_id);

create index idx_sales_business_date on sales(business_id, sale_date);

create index idx_inventory_items_business_id on inventory_items(business_id);

create index idx_inventory_transactions_item_date
  on inventory_transactions(inventory_item_id, transaction_date);
create index idx_inventory_transactions_business_id on inventory_transactions(business_id);

create index idx_content_items_business_id on content_items(business_id);
create index idx_content_items_date on content_items(business_id, content_date);

create index idx_goals_business_id on goals(business_id);
create index idx_goals_active_range on goals(business_id, start_date, end_date);

create index idx_daily_reviews_business_date on daily_reviews(business_id, review_date);

create index idx_activity_logs_business_id on business_activity_logs(business_id, created_at desc);

create index idx_business_invitations_business_id on business_invitations(business_id);
-- At most one open invitation per email per business.
create unique index idx_business_invitations_open_email
  on business_invitations(business_id, email) where accepted_at is null;

create index idx_push_subscriptions_business on push_subscriptions(business_id);
create index idx_push_subscriptions_user on push_subscriptions(user_id);


-- ============================================================================
-- 4. updated_at trigger, on every table that has the column
-- ============================================================================

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


-- ============================================================================
-- 5. Access helpers
--
-- SECURITY DEFINER so they can read business_members without triggering that
-- table's own RLS policy (which would recurse).
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

create or replace function business_has_members(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from business_members where business_id = target_business_id
  );
$$;

comment on function business_has_members is
  'True if the business already has at least one member. SECURITY DEFINER so it can check regardless of the caller''s RLS visibility.';

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

-- Permission rules (mirrored in src/lib/team.ts for the UI):
--   owner  can invite / re-role / remove admins and staff
--   admin  can invite / re-role / remove staff only
--   staff  can't manage the team
--   nobody can change or remove an owner through the app
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

-- Has the (single) business been created yet? Callable before sign-in so the
-- sign-up page knows whether first-time setup is still open.
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

-- Storage: true when the object's first folder is a business the signed-in
-- user belongs to. A folder that isn't a UUID simply doesn't match.
create or replace function is_product_image_owner(object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from business_members m
    where m.user_id = auth.uid()
      and m.business_id::text = (storage.foldername(object_name))[1]
  );
$$;

-- Storage: owner/admin of the business named by the file's first folder.
create or replace function can_manage_catalogue_file(object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from businesses b
    where b.id::text = (storage.foldername(object_name))[1]
      and can_manage_business(b.id)
  );
$$;


-- ============================================================================
-- 6. App functions
-- ============================================================================

-- ---- team ------------------------------------------------------------------

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

  -- One business per account (see getCurrentBusinessContext).
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

-- Team list with each person's email, own name and photo. These live in
-- auth.users, which the app can't read directly; only members of the same
-- business get them. Only https photo links are passed through.
create or replace function get_business_members(p_business_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  role business_member_role,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.user_id,
    u.email::text,
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    case when u.raw_user_meta_data ->> 'avatar_url' like 'https://%' then u.raw_user_meta_data ->> 'avatar_url' end,
    m.role,
    m.created_at
  from business_members m
  join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
    and is_business_member(p_business_id)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

revoke all on function get_business_members(uuid) from public;
grant execute on function get_business_members(uuid) to authenticated;

-- The owner hands ownership to another member: they become 'owner' and the
-- previous owner becomes 'admin', in one transaction, so there is always
-- exactly one owner. The only sanctioned way to change an owner role.
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

-- ---- inventory -------------------------------------------------------------

-- Logs a transaction AND updates the item's current_quantity in one round
-- trip, with the row locked, so two at the same moment can't drop one.
-- SECURITY INVOKER: RLS still applies to both tables.
--   purchase → quantity increases by p_quantity
--   usage / waste → decreases by p_quantity
--   adjustment → SET to p_quantity (a stock count)
-- current_quantity never goes below zero.
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
  'Atomically logs an inventory transaction and updates current_quantity. Called via supabase.rpc() from src/lib/services/inventory.ts.';

-- ---- receipts --------------------------------------------------------------

-- Issues (or, if already issued, returns) the receipt number for a completed
-- order. SECURITY INVOKER: RLS still decides which orders the caller can
-- touch. A per-business advisory lock means two receipts issued at the same
-- moment can't get the same number.
create or replace function issue_order_receipt(p_order_id uuid, p_payment_method text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  o orders;
  next_number integer;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception 'That order could not be found.';
  end if;
  if o.status <> 'completed' then
    raise exception 'Only completed orders can have a receipt.';
  end if;

  if o.receipt_number is not null then
    update orders set payment_method = coalesce(p_payment_method, payment_method) where id = o.id;
    return o.receipt_number;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('receipt:' || o.business_id::text, 0));

  select coalesce(max(receipt_number), 0) + 1 into next_number
  from orders
  where business_id = o.business_id;

  update orders
  set receipt_number = next_number,
      receipt_issued_at = now(),
      payment_method = p_payment_method
  where id = o.id;

  return next_number;
end;
$$;

revoke all on function issue_order_receipt(uuid, text) from public;
grant execute on function issue_order_receipt(uuid, text) to authenticated;

-- ---- ready stock and recipes -----------------------------------------------

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

-- Takes the ingredients for `p_units` units of a product out of inventory, as
-- normal 'usage' transactions. Called by the app when a batch is added to
-- ready stock, and by the order trigger for made-to-order products.
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

-- ---- customer menu ---------------------------------------------------------

-- Public (no sign-in): only what the /menu page shows.
create or replace function get_public_menu()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'name', b.name,
    'phone', b.phone,
    'menu_pdf_url', b.menu_pdf_url,
    'menu_pdf_updated_at', b.menu_pdf_updated_at,
    'instagram_url', b.instagram_url,
    'facebook_url', b.facebook_url,
    'tiktok_url', b.tiktok_url,
    'threads_url', b.threads_url
  )
  from businesses b
  order by b.created_at
  limit 1;
$$;

revoke all on function get_public_menu() from public;
grant execute on function get_public_menu() to anon, authenticated;

-- ---- system status ---------------------------------------------------------

-- The database's version. Settings → System compares it with the version the
-- app expects (SCHEMA_VERSION in src/lib/system-status.ts) and says when an
-- update from supabase/updates/ hasn't been run. Every update file bumps it.
create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 1;
$$;

revoke all on function schema_version() from public;
grant execute on function schema_version() to authenticated;

-- What Settings → System shows the owner: database and photo-storage size (to
-- compare with the Supabase free plan), row counts and number of logins.
-- SECURITY DEFINER because it reads sizes and auth/storage tables a normal
-- user can't; it refuses anyone who isn't the owner. Numbers only — never
-- any customer or account details.
create or replace function app_system_status()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from business_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can view system status.';
  end if;

  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'product-images'), 0),
    'storage_files', (select count(*) from storage.objects where bucket_id = 'product-images'),
    'auth_users', (select count(*) from auth.users),
    'rows', jsonb_build_object(
      'orders', (select count(*) from orders),
      'order_items', (select count(*) from order_items),
      'customers', (select count(*) from customers),
      'products', (select count(*) from products),
      'inventory_transactions', (select count(*) from inventory_transactions),
      'tasks', (select count(*) from tasks),
      'activity_logs', (select count(*) from business_activity_logs)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function app_system_status() from public;
grant execute on function app_system_status() to authenticated;


-- ============================================================================
-- 7. Order triggers
-- ============================================================================

-- orders.completed_on: the business-local day an order was completed, which
-- is the day it counts as a sale.
--   * inserted already completed (recording a past sale): keeps the date given
--   * becomes completed by an update: today
--   * edited while completed: accepts a changed date (correcting it)
-- A sale date can't be in the future.
create or replace function set_order_completed_on()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (
    now() at time zone coalesce(
      (select timezone from business_settings where business_id = new.business_id),
      'Asia/Kuala_Lumpur'
    )
  )::date;
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' then
      new.completed_on := coalesce(new.completed_on, v_today);   -- a past sale keeps its date
    elsif old.status is distinct from 'completed' then
      new.completed_on := v_today;                                -- completed just now
    elsif new.completed_on is null then
      new.completed_on := coalesce(old.completed_on, v_today);    -- never lose the date
    end if;                                                       -- otherwise: keep / accept an edited date
    if new.completed_on > v_today then
      raise exception 'The sale date can''t be in the future.';
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

-- When an order BECOMES completed by an update:
--   * stock-tracked products come out of ready stock
--   * made-to-order products (ready_stock null) use their recipe ingredients
-- Moving it out of completed (back to ready, or cancelled) undoes both:
-- ready stock goes back, and exactly the usage records it made are removed.
-- Recording a past sale (inserted completed) touches neither.
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

  -- Ready stock: tracked products only.
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

create trigger trg_orders_ready_stock
  after update of status on orders
  for each row execute function apply_order_ready_stock();


-- ============================================================================
-- 8. Row Level Security
--
-- A user must never read or write another business's data. Most tables:
-- members of the business can do everything with its rows. Business details,
-- settings and the schedule: everyone reads, only owners/admins change.
-- ============================================================================

-- ---- businesses ------------------------------------------------------------

alter table businesses enable row level security;

create policy "members can view their business"
  on businesses for select
  using (is_business_member(id));

create policy "managers can update their business"
  on businesses for update
  using (can_manage_business(id))
  with check (can_manage_business(id));

-- Only while no business exists (first-time setup).
create policy "first user can create the business"
  on businesses for insert
  with check (auth.uid() is not null and not app_is_set_up());

-- ---- business_members ------------------------------------------------------

alter table business_members enable row level security;

create policy "members can view their own membership rows"
  on business_members for select
  using (user_id = auth.uid() or is_business_member(business_id));

-- The very first owner adds themselves during setup, only while the business
-- has no members. Everyone else joins through the app (service-role key) or
-- accept_business_invitation().
create policy "user can add themselves as first owner"
  on business_members for insert
  with check (
    user_id = auth.uid()
    and not business_has_members(business_id)
  );

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

-- ---- business_settings -----------------------------------------------------

alter table business_settings enable row level security;

create policy "members can view their business settings"
  on business_settings for select
  using (is_business_member(business_id));

create policy "managers can manage their business settings"
  on business_settings for all
  using (can_manage_business(business_id))
  with check (can_manage_business(business_id));

-- ---- schedule_blocks -------------------------------------------------------

alter table schedule_blocks enable row level security;

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

-- ---- tables any member can use ---------------------------------------------

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

-- product_costs, order_items and product_recipe_items have no business_id of
-- their own: access follows the parent row's business.
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

alter table product_recipe_items enable row level security;
create policy "members can access their recipe items"
  on product_recipe_items for all
  using (exists (select 1 from products where products.id = product_recipe_items.product_id and is_business_member(products.business_id)))
  with check (exists (select 1 from products where products.id = product_recipe_items.product_id and is_business_member(products.business_id)));

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

-- ---- activity log: read and add only, history can't be edited --------------

alter table business_activity_logs enable row level security;
create policy "members can view their activity logs"
  on business_activity_logs for select
  using (is_business_member(business_id));
create policy "members can create activity log entries"
  on business_activity_logs for insert
  with check (is_business_member(business_id));

-- ---- invitations -----------------------------------------------------------

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

-- ---- notifications ---------------------------------------------------------
-- Saving and sending go through the server with the service-role key (it has
-- to read everyone's devices to notify the team). These own-row policies only
-- make sure a signed-in client can never see anyone else's.

alter table push_subscriptions enable row level security;

create policy "people can see their own devices"
  on push_subscriptions for select
  using (user_id = auth.uid());

create policy "people can remove their own devices"
  on push_subscriptions for delete
  using (user_id = auth.uid());

alter table notification_preferences enable row level security;

create policy "people can see their own notification preferences"
  on notification_preferences for select
  using (user_id = auth.uid());


-- ============================================================================
-- 9. Storage buckets
--
-- All three are public-read (the URLs are unguessable and the files are meant
-- to be shown); who may upload or delete is limited by the policies below.
-- ============================================================================

-- ---- product-images: <business_id>/<random>.jpg, resized in the browser ----

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "members can read their product images"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and is_product_image_owner(name));

create policy "members can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and is_product_image_owner(name));

create policy "members can replace product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and is_product_image_owner(name));

create policy "members can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and is_product_image_owner(name));

-- ---- catalogue: the menu's PDF, max 50 MB, owner/admin only ----------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogue', 'catalogue', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "managers can read catalogue files"
  on storage.objects for select to authenticated
  using (bucket_id = 'catalogue' and can_manage_catalogue_file(name));

create policy "managers can upload catalogue files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogue' and can_manage_catalogue_file(name));

create policy "managers can delete catalogue files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalogue' and can_manage_catalogue_file(name));

-- ---- avatars: <user id>/<random>.jpg, each person only in their own folder -

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "people can read their own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "people can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "people can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
