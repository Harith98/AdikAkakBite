// ============================================================================
// Structured return types for the analytics/service layer (spec §32).
//
// These shapes are the contract between the database and everything above
// it — the dashboard UI in V1 today, and a future AI provider (spec §33)
// tomorrow. The functions that return these (getDailySummary,
// getWeeklySummary, getSalesForecast, etc.) are implemented in Phase 5/6;
// the types are defined now so Phase 1's foundations are already
// AI-ready-shaped, per the project's core requirement.
//
// Rule that must never be broken (spec §34): every number in these types is
// produced by SQL/application arithmetic, never by an LLM. A future AI
// provider only ever *reads* and *explains* these structures — it does not
// compute them.
// ============================================================================

export interface Money {
  /** Amount in the business's own currency (no multi-currency conversion in V1). */
  amount: number
  currency: string
}

export interface TopProduct {
  productId: string
  name: string
  quantity: number
}

export interface PeriodSummary {
  period: 'today' | 'current_week' | 'current_month' | string
  startDate: string // ISO date
  endDate: string // ISO date
  revenue: number
  previousRevenue: number | null
  revenueChangePercent: number | null
  orders: number
  averageOrderValue: number
  newCustomers: number
  repeatCustomers: number
  topProduct: TopProduct | null
}

export type DataSufficiency = 'very_limited' | 'early_estimate' | 'developing' | 'reliable'

export interface ForecastConfidence {
  level: DataSufficiency
  /** Number of days of relevant historical data behind this estimate. */
  historyDays: number
  label: string
}

export interface SalesForecast {
  targetDate: string // ISO date, e.g. the upcoming Saturday
  estimatedRevenueLow: number
  estimatedRevenueHigh: number
  method: 'moving_average' | 'day_of_week_average' | 'trend_adjusted'
  confidence: ForecastConfidence
  /** Always true in V1 — forecasts are estimates, never guarantees. See spec §51. */
  isEstimate: true
}

export interface InventoryForecast {
  inventoryItemId: string
  itemName: string
  currentQuantity: number
  unit: string
  averageDailyUsage: number | null
  estimatedDaysRemaining: number | null
  status: 'ok' | 'monitor' | 'reorder' | 'out_of_stock' | 'insufficient_data'
  /** Human-readable explanation, e.g. "Not enough historical data for a reliable estimate." */
  note: string | null
}

export interface CustomerMetrics {
  customerId: string
  name: string
  firstOrderDate: string | null
  lastOrderDate: string | null
  numberOfOrders: number
  totalSpending: number
  isRepeatCustomer: boolean
  daysSinceLastOrder: number | null
  /** Completed orders per month over the active period (first order → today, minimum one month). */
  purchasesPerMonth: number | null
  /** Orders that are not yet completed or cancelled. */
  openOrders: number
}

export interface BusinessHealthIndicator {
  key: string
  label: string
  /** Free-form display value, e.g. "📈 Increasing", "3 items low", "36%". */
  value: string
  trend: 'up' | 'down' | 'flat' | 'neutral'
}

export interface RecommendedTask {
  taskId: string | null
  orderId: string | null
  title: string
  /** Plain-language explanation of why this was chosen (spec §12). */
  reason: string
  category: string
  source:
    | 'urgent_order'
    | 'overdue_task'
    | 'in_progress_task'
    | 'schedule_block'
    | 'daily_priority'
    | 'inventory_alert'
    | 'next_scheduled'
    | 'all_done'
}
