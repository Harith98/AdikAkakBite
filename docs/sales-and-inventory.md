# Sales & inventory (Phase 3B)

## Sales — live, not stored
Business → Sales shows Today / This week / This month revenue, order count and average order value,
computed **live** from completed orders every time the page loads (`getSalesSummary`). Nothing is cached in
the `sales` table — that table exists in the schema (migration 0001) but is deliberately left unused for now,
so there is exactly one source of truth for revenue. If a business ever grows large enough that recomputing
this on every page load is slow, `sales` is where a materialized daily rollup would go — the page's return
shape would not need to change.

Weeks run Monday–Sunday (ISO week).

## The daily close
Spec §8's Closing block and §61's acceptance test both describe the owner recording revenue, orders and waste
at day's end. Revenue and orders are never manually typed in: closing the day snapshots the already-computed
numbers from `getSalesSummary` into `daily_reviews` alongside the one number that genuinely needs manual entry —
**waste value** — plus optional notes. This keeps the closing record and the live dashboard from ever
disagreeing about what today's revenue was.

The Today screen shows a "Wrap up the day" / "Today's close is saved" card once the Closing block is the
active schedule block, linking to Business → Sales. Closing can be updated any time — it's an upsert on
`(business_id, review_date)`, not a one-shot action.

## Inventory
Business → Inventory lists items with their live status (`ok` / `low` / `reorder` / `out_of_stock`, from the
`getInventoryStatus` calc already built in Phase 2) and links straight into the Today screen's alerts and
recommendation engine — no wiring was needed there, since Phase 2 already read from `inventory_items`.

**Editing an item never changes its stock quantity.** Name, category, unit, reorder level, cost, supplier,
expiry and notes are a plain update. Quantity only moves through a **logged transaction**:

| Type | Effect on stock |
|---|---|
| Purchase | `current_quantity += quantity` |
| Usage | `current_quantity -= quantity` |
| Waste | `current_quantity -= quantity` |
| Adjustment | `current_quantity = quantity` (corrects a stock count to a known value) |

This is enforced by a Postgres function, `record_inventory_transaction` (migration 0007), which locks the
item row, computes the new quantity, inserts the transaction, and updates the item — all in one call — so two
transactions logged at the same moment can't race and silently drop one of them. Stock never goes below zero.
The function runs as `SECURITY INVOKER` (the default), so it's still subject to Row Level Security exactly as
if the two statements had been run directly.

## Known limits (deliberate, for later phases)
- No average-daily-usage / days-remaining estimate yet — that's forecasting, Phase 6 (see `docs/forecasting.md`).
- No week-over-week comparison or top-products ranking on the Sales page yet — that's Phase 5 (dashboard/analytics),
  to keep this phase's scope to what the spec calls the Sales module itself.
