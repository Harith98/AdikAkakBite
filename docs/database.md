# Database

PostgreSQL via Supabase. The whole schema is one file: [`supabase/schema.sql`](../supabase/schema.sql).

## Setting up a new database

Create a Supabase project, open **SQL Editor**, paste `supabase/schema.sql` and run it. That creates everything: types, tables, indexes, functions, triggers, Row Level Security and the three storage buckets (`product-images`, `catalogue`, `avatars`). Then start the app, sign up and finish first-time setup, which creates the business and its starter schedule.

Never run `schema.sql` on a database that's already set up: it creates tables and fails on the first one that exists.

## Changing the database later

Every change is made in **two places**, in the same commit:

1. **`supabase/schema.sql`** — edit it so it still describes the whole database as it is now (a new column goes in its `create table`, a changed function replaces the old one). A new setup always runs just this file.
2. **A new file in `supabase/updates/`**, named `YYYY-MM-DD_what_it_does.sql`, that makes the same change to an existing database (`add column if not exists`, `create or replace function`, …). Write it so running it twice is harmless. Its last change bumps `schema_version()` by one.

Then raise `SCHEMA_VERSION` in `src/lib/system-status.ts` to the same number. Settings → System compares the two and says when the live database is behind, so run the update file in the SQL Editor **before** deploying the code that needs it.

The file `2026-10-20_single_schema_file.sql` is the one that moved the live database from the old numbered migrations (0001–0028, still in git history) onto `schema.sql`, at version 1.

## What's in it

| Area | Tables / functions |
|---|---|
| The shop and its people | `businesses` (one row only: `businesses_single_row`), `business_members` (owner / admin / staff), `business_settings`, `business_invitations`. Each person's own name and photo live in their auth metadata; `get_business_members()` returns them for the Team page. |
| Daily work | `schedule_blocks` (the editable daily schedule), `tasks` (`daily_priority_rank` for today's three priorities; `uq_tasks_schedule_materialization` makes creating each day's tasks idempotent) |
| Orders and customers | `orders`, `order_items` (name and price snapshotted), `customers` (`phone_key`: a generated, normalised phone that must match `normalizePhone()` in `src/lib/customer-identity.ts`) |
| Sales | Computed live from completed orders, grouped by `orders.completed_on` (set by `set_order_completed_on()`: today when an order becomes completed, or the date given when recording a past sale; never in the future). `daily_reviews` holds waste from older daily closes. `sales` is unused. |
| Receipts | `orders.receipt_number` / `receipt_issued_at` / `payment_method`; `issue_order_receipt()` hands out per-business sequential numbers under an advisory lock, never reused. |
| Products | `products` (`ready_stock`: null = not tracked; `recipe_yield`; `nicknames` for the WhatsApp paste reader), `product_costs` (cost history), `product_recipe_items`. `adjust_product_ready_stock()` does atomic +/-. |
| Inventory | `inventory_items`, `inventory_transactions`. `record_inventory_transaction()` logs a transaction and updates stock atomically; `use_recipe_ingredients()` logs recipe usage. |
| Order trigger | `apply_order_ready_stock()`: when an order becomes completed, tracked products leave ready stock and made-to-order products use their recipe ingredients (reference `order:<id>`); leaving completed undoes both. Recording a past sale touches neither. |
| Notifications | `push_subscriptions` (one per device), `notification_preferences` (no row = all on), `orders.due_reminder_sent_for`. Sent by the server with the service-role key. |
| Expenses (version 2) | `expenses`: overheads only (rent, utilities, petrol, equipment, marketing, other), never ingredients or packaging, which are already in product costs. A repeating row (`repeats_monthly`) counts every month on its day until `ends_on`; `expandExpenses()` in `src/lib/expenses.ts` turns rows into monthly entries. Net profit = gross profit − overheads. |
| Catalogue opens (version 3) | `catalogue_opens`: opens per day of the menu PDF, counted by `/menu/catalogue` through `count_catalogue_open()` (service-role only), then redirected to the PDF. Settings → System estimates data transfer as opens × PDF size against the free 5 GB a month. |
| Customer menu | `businesses.menu_pdf_url` and the social links; `get_public_menu()` is the only thing `/menu` reads (anon-callable, public info only). |
| Other | `content_items`, `goals`, `business_activity_logs` (append-only; the daily jobs log here too), `app_system_status()` and `schema_version()` for Settings → System. |

## Team roles

| Role | Can do |
|---|---|
| `owner` | Everything, including inviting/re-roling/removing admins and staff. Can't be removed or re-roled through the app; can hand ownership to another member with `transfer_business_ownership()`. |
| `admin` | Business settings, daily schedule, inviting/re-roling/removing staff. |
| `staff` | Day-to-day work: Today, orders, products, inventory, customers, sales. |

Enforced in SQL by `can_manage_business()` and `can_manage_role()`; `src/lib/team.ts` mirrors the same rules only to decide which controls the UI shows. Team members are added by an owner/admin in Settings → Team, which creates their login directly through the Supabase admin API (server-only `SUPABASE_SERVICE_ROLE_KEY`): no email, account pre-confirmed, a temporary password they must change at first sign-in (`must_change_password` user metadata). Removing a member also deletes their login. The `business_invitations` table and invite functions are no longer used by the app.

## Conventions

- **UUID primary keys** everywhere, via `gen_random_uuid()` (`pgcrypto`).
- **`business_id`** on every business-owned table — the multi-tenancy boundary. See `docs/architecture.md#multi-tenancy`.
- **`created_at` / `updated_at`** on every table; `updated_at` is maintained by a shared trigger (`set_updated_at()`), not application code, so it's correct regardless of which client writes the row.
- **Enums over free-text** for every closed set of values (`order_status`, `task_category`, etc.) — catches typos at the database level and matches the fixed vocabularies in the product spec.
- **Money** is `numeric(12,2)` in the business's own currency. No multi-currency conversion in V1 — one currency per business (`business_settings.currency`, default MYR).

## Derived vs. stored data

A deliberate pattern throughout: values that can be *computed* from other rows are **never stored as columns**. They're computed in SQL or the service layer instead, so they can never drift out of sync with their source data. Examples:

| Derived value | Computed from | Where |
|---|---|---|
| Product `total_cost`, `gross_profit`, `gross_margin` | `product_costs.ingredient_cost + packaging_cost + other_cost`, `selling_price - total_cost`, etc. | Service layer (Phase 3) |
| Order `total`, `balance` | `order_items` sum, minus `discount`/`deposit`, plus `delivery_fee` | Service layer (Phase 3) |
| Customer `total_spending`, `number_of_orders`, `first/last_order_date` | Aggregated from `orders` | `getCustomerMetrics` (Phase 3) |
| Inventory `status` (ok/low/reorder/out_of_stock) | `current_quantity` vs `reorder_level` | `getInventoryStatus` (Phase 5) |
| Inventory `estimated_days_remaining` | Moving average of `inventory_transactions` (usage) | `getInventoryForecast` (Phase 6) |
| Goal `current_value`, `progress_percent` | The relevant source table for the goal's `metric`, filtered to its date range | `getBusinessGoals` (Phase 5) |

## Historical accuracy: `product_costs` and `order_items`

Two tables exist specifically to keep history honest as the business changes over time:

- **`product_costs`** is a separate table from `products`, not columns on it. Each row has `effective_from`/`effective_to`; the current cost is the row where `effective_to is null`. This means a cost change today doesn't retroactively change last month's margin calculations.
- **`order_items`** snapshots `product_name` and `unit_price` at the time of the order, rather than joining live to `products`. A renamed, repriced, or later-deleted product doesn't corrupt historical order records.

## Row Level Security

Every business-owned table has RLS enabled with a policy built on `is_business_member(business_id)`, a `SECURITY DEFINER` SQL function that checks `business_members` directly. This function exists specifically to avoid a Postgres RLS recursion trap: a naive policy on `business_members` that queries `business_members` again (through the normal, RLS-enforced path) via PostgREST would recurse. `SECURITY DEFINER` lets the function read that one table without triggering its own policy.

Two tables (`product_costs`, `order_items`) have no `business_id` column of their own; their policies check membership through their parent row (`products`/`orders`) instead.

`business_activity_logs` is select + insert only — no update/delete policy — so application-level history can't be edited after the fact.

## Regenerating TypeScript types

`src/lib/supabase/database.types.ts` is hand-written to match Phase 1's schema, so the app has real type-checking before a live project exists. Once you have one:

```bash
npm run db:types
```

This overwrites the file with an accurate, generated version from your actual schema. Re-run it after changing the database.
