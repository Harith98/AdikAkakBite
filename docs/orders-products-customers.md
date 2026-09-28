# Orders, products & customers (Phase 3A)

## Products & costing
`product_costs` holds each product's ingredient / packaging / other cost with a start and end date. Editing a
product only touches cost history if a cost actually changed: the **new** cost row is inserted first, then the old
one is closed (`effective_to`), so a failure part-way can never leave a product with no cost.

Derived, never stored (`src/lib/calc/products.ts`):
- total cost = ingredient + packaging + other
- gross profit = selling price − total cost (negative if it loses money)
- gross margin = gross profit ÷ selling price × 100 (blank when the price is 0)

Selling price is a column on `products`, so changing it is not versioned — margins always use today's price
with the cost in effect. (Past *orders* are unaffected: each order item keeps its own name and price.)
Deleting a product is safe for the same reason. Product images are an optional link; uploads are not built.

## Orders
- Created from **Orders → New order**: customer, items (from your products or custom), when needed, discount,
  delivery fee, deposit. New orders start as **Confirmed** and appear on Today when due.
- `total = items − discount + delivery fee`; `balance = total − deposit`. Payment status follows the money
  (`derivePaymentStatus`): nothing paid → Unpaid, something paid → Deposit paid, all paid → Fully paid.
  "Paid in full" sets the deposit to the total.
- The form shows live totals for convenience, but the server re-validates and re-calculates everything
  (`src/lib/validation/orders.ts`). Discounts can't exceed the items total; deposits can't exceed the order total.
- There is no delete: cancel an order instead (it can be reopened). Cancelled orders are excluded from all customer metrics.
- Saving writes the order and its items in separate steps. If a step fails it is rolled back by hand (a half-created
  order is deleted; on edit, new items are added *before* old ones are removed).

## Customers
Customers are created automatically from orders (name match is case-insensitive) — there is no separate
"add customer" form. Metrics are derived from orders each time (`src/lib/calc/customers.ts`):
- Only **completed** orders count as purchases; open orders are shown separately; cancelled are ignored.
- Lifetime value = sum of completed order totals. Repeat customer = more than one completed order.
- Orders per month = completed orders ÷ active period (first completed order → today, minimum one month).

Metrics are computed in application code, which is fine at small-business scale. If a business ever reaches tens of
thousands of orders, move `getCustomerMetrics` into a SQL view — its return shape would not change.
Large id lists are fetched in chunks (`selectInChunks`) to stay under PostgREST's URL length limit.
