# Forecasting (design — implemented in Phase 6)

Not built yet. This documents the approach Phase 6 will follow, per product spec §19 and §23–25, so the method is settled before the code is written.

## Principle

Every forecast is a mathematical estimate from this business's own historical data — never AI, never a guarantee. See `docs/ai-readiness.md` for why AI is barred from computing numbers, and spec §51 for the required language ("Estimated", "Based on recent data" — never "Sales will definitely be...").

## Sales forecasting — three methods (spec §23)

1. **Moving average** — the average of recent comparable periods.
2. **Day-of-week average** — e.g. average Saturday revenue over previous Saturdays, since a small dessert business's demand is highly day-of-week dependent (spec's own example: weekend uplift).
3. **Trend** — recent periods compared to previous periods, to catch sustained growth or decline the day-of-week average alone would miss.

`getSalesForecast()` combines these into a range (e.g. "RM1,800–RM2,100"), not a single number, computed mathematically from historical variation (spec §25) — never fabricated when data is thin.

## Inventory forecasting (spec §19)

```
average_daily_usage = total usage over the last 14 days / 14
estimated_days_remaining = current_quantity / average_daily_usage
```

Sourced from `inventory_transactions` where `transaction_type = 'usage'`. If there isn't enough history yet, `getInventoryForecast()` returns `status: 'insufficient_data'` and the note "Not enough historical data for a reliable estimate" (spec §19, §52) rather than guessing.

## Forecast confidence (spec §24)

A simple indicator of *data availability*, not statistical confidence in the usual sense:

| History available | Level |
|---|---|
| < 2 weeks | 🔴 Very limited data |
| 2–4 weeks | 🟠 Early estimate |
| 1–3 months | 🟡 Developing estimate |
| 3+ months | 🟢 More reliable estimate |

This maps directly to the `ForecastConfidence` type already defined in `src/lib/services/types.ts`.

## New-business behavior (spec §52)

If there isn't enough historical data for a given forecast, the UI must say so plainly — "Not enough historical data yet. Continue recording sales. Forecasts will become more useful as more history is collected." — rather than fabricating a number from too little data.

## Testing (spec §50)

When Phase 6 implements these, tests must cover: zero sales, no orders, no inventory transaction history, a business younger than the shortest confidence window, and the boundary between confidence levels.
