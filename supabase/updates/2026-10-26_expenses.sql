-- ============================================================================
-- 2026-10-26_expenses.sql — schema version 1 → 2
--
-- Overheads: what the shop spends that isn't part of a product's cost (rent,
-- utilities, petrol, equipment, marketing, other). Ingredients and packaging
-- are NOT logged here: they're already in each product's cost, so logging
-- them again would count them twice. Net profit = gross profit − overheads.
--
-- A repeating expense (e.g. rent) is ONE row with repeats_monthly = true: it
-- counts every month from expense_date (on the same day of the month) until
-- ends_on, if set. Nothing is copied month to month.
--
-- Run once in the Supabase SQL Editor. Running it twice is refused, changing nothing.
-- ============================================================================

-- Guard: refuses (and changes nothing) if this update is already applied, or
-- if the update before it hasn't been run. The whole file is one transaction.
do $guard$
declare
  v_version integer := case when to_regprocedure('public.schema_version()') is null then 0 else schema_version() end;
begin
  if v_version >= 2 then
    raise exception 'Already done: this database is at version %, and this file is version 2. Nothing was changed.', v_version;
  end if;
  if v_version < 1 then
    raise exception 'Run the earlier update files first: this database is at version %, and this file needs version 1. Nothing was changed.', v_version;
  end if;
end;
$guard$;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  expense_date date not null,
  amount numeric(12,2) not null,
  category text not null,
  note text,
  repeats_monthly boolean not null default false,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_category_valid check (category in ('rent', 'utilities', 'petrol', 'equipment', 'marketing', 'other')),
  constraint expenses_note_length check (note is null or length(note) <= 200),
  constraint expenses_ends_after_start check (ends_on is null or ends_on >= expense_date)
);
comment on table expenses is 'Overheads (not product costs). A repeating row counts monthly from expense_date until ends_on.';

create index if not exists idx_expenses_business_date on expenses(business_id, expense_date);

drop trigger if exists set_updated_at on expenses;
create trigger set_updated_at before update on expenses
  for each row execute function set_updated_at();

alter table expenses enable row level security;
drop policy if exists "members can access their expenses" on expenses;
create policy "members can access their expenses"
  on expenses for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 2;
$$;

select schema_version() as schema_version; -- should say 2
