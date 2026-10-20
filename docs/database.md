# Database

PostgreSQL via Supabase. Migrations live in `supabase/migrations/`, numbered and meant to be applied in order:

1. `0001_init_schema.sql` — tables, enum types, the `updated_at` trigger
2. `0002_indexes.sql` — indexes
3. `0003_rls_policies.sql` — Row Level Security
4. `0004_onboarding_membership_policy.sql` — lets a new business's first owner add themselves (bootstrapping)
5. `0005_task_priorities_and_ordering.sql` — `tasks.daily_priority_rank`, `tasks.sort_order`, and the unique indexes that make daily task creation idempotent
6. `0006_customer_name_index.sql` — index for finding a customer by name when creating an order
7. `0007_inventory_transactions_rpc.sql` — `record_inventory_transaction()`, an atomic stock-update function
8. `0008_member_admin_role.sql` — adds the `admin` member role (own file: a new enum value can't be used in the transaction that adds it)
9. `0009_team_invitations.sql` — `business_invitations`, role-aware membership policies (replaces 0003's "any member can manage members"), owner/admin-only writes to settings and the schedule, and the `get_invitation` / `accept_business_invitation` / `get_business_members` functions
10. `0010_transfer_ownership.sql` — `transfer_business_ownership()`: the owner hands ownership to an existing member and becomes an admin, atomically
11. `0011_receipts.sql` — business contact fields (phone, email, address, registration number, receipt message), `orders.receipt_number` / `receipt_issued_at` / `payment_method`, and `issue_order_receipt()`, which assigns per-business sequential receipt numbers under an advisory lock. Numbers are never reused or changed once issued.
12. `0012_customer_phone_key.sql` — `customers.phone_key`, a generated, normalised phone number (indexed) used to identify customers phone-first. Must stay in sync with `normalizePhone()` in `src/lib/customer-identity.ts`.
13. `0013_single_business.sql` — makes the deployment single-business: `businesses` can hold at most one row, only the first account may create it (while none exists), and `app_is_set_up()` tells the sign-in/sign-up pages whether first-time setup is still open. After setup, people join only by invitation; signed-in non-members see `/no-access`.
14. `0014_member_display_names.sql` — `get_business_members()` also returns each member's own name (`display_name` from their auth user metadata, set at sign-up or in Settings → Your profile) for the Team page.
15. `0015_order_completed_on.sql` — `orders.completed_on`, the business-local day an order was completed, set by a trigger. Sales totals and the daily close group by it, so an advance order counts on the day it's fulfilled, not the day it was taken. Orders completed earlier are backfilled with their `order_date`.
16. `0016_push_notifications.sql` — phone notifications (web push): `push_subscriptions` (one row per device), `notification_preferences` (per person; no row = all on) and `orders.due_reminder_sent_for`. Sent from `src/lib/notifications/` with the service-role key: low stock (inventory actions), schedule changes (schedule actions), and a daily 8am (MYT) "due in 2 days" reminder from Vercel Cron → `/api/cron/order-reminders`.
17. `0017_product_ready_stock.sql` — `products.ready_stock` (finished units on hand; null = not tracked; may go negative = oversold), `adjust_product_ready_stock()` for atomic +/- and a trigger on `orders` that takes items out of ready stock when an order becomes completed and puts them back if it leaves completed.
18. `0018_product_images.sql` — public Storage bucket `product-images` (5 MB limit, JPEG/PNG/WebP) with member-only upload/replace/delete policies via `is_product_image_owner()`. Files live at `<business_id>/<uuid>.jpg`; `products.image_url` holds the public URL. Photos are resized in the browser before upload (`ProductImagePicker`), and replaced/deleted photos are removed from storage by the product actions.
19. `0019_posting_reminder_preference.sql` — `notification_preferences.posting_reminder` for the 8pm (MYT) posting reminder, sent by Vercel Cron → `/api/cron/posting-reminders` when today's Content checklist is incomplete.
20. `0020_recipes.sql` — recipes: `products.recipe_yield` (units per batch) and `product_recipe_items` (inventory item + amount per batch, in the item's unit). `use_recipe_ingredients()` logs `usage` transactions; the app calls it when a batch is added to ready stock, and the (replaced) `apply_order_ready_stock()` trigger calls it when an order with made-to-order products completes (reference `order:<id>`), undoing exactly those records if the order leaves completed.
21. `0021_editable_sale_date.sql` — `set_order_completed_on()` now keeps a `completed_on` given on insert (recording a past sale) and accepts edits on completed orders (correcting the sale date); becoming completed by an update still stamps today; future dates are refused. Past sales don't touch ready stock or ingredients.
22. `0022_system_status.sql` — `app_system_status()` (owner only, SECURITY DEFINER): database and product-photo storage size, login count, row counts and a marker per migration (0008–0022), for Settings → System status. The daily cron jobs also log `cron_order_reminders` / `cron_posting_reminders` to `business_activity_logs` so that page can show when they last ran.

## Team roles

| Role | Can do |
|---|---|
| `owner` | Everything, including inviting/re-roling/removing admins and staff. Can't be removed or re-roled through the app; can hand ownership to another member with `transfer_business_ownership()`. |
| `admin` | Business settings, daily schedule, inviting/re-roling/removing staff. |
| `staff` | Day-to-day work: Today, orders, products, inventory, customers, sales. |

Enforced in SQL by `can_manage_business()` and `can_manage_role()`; `src/lib/team.ts` mirrors the same rules only to decide which controls the UI shows. Team members are added by an owner/admin in Settings → Team, which creates their login directly through the Supabase admin API (server-only `SUPABASE_SERVICE_ROLE_KEY`): no email, account pre-confirmed, a temporary password they must change at first sign-in (`must_change_password` user metadata). Removing a member also deletes their login. The `business_invitations` table and invite functions from 0009 are no longer used by the app.

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

This overwrites the file with an accurate, generated version from your actual schema — always re-run it after changing a migration.
