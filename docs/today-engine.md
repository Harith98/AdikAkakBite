# Today screen & recommendation engine (Phase 2)

Everything on the Today screen is produced by ordinary code — no AI. The logic lives in pure functions
(`src/lib/services/recommendation.ts`, `schedule.ts`, `priorities.ts`) that take data in and return a result,
with no database or clock access, so every rule below is covered by unit tests in `tests/unit/`.

## How a day's tasks are created

Each schedule block has a list of default tasks. The first time a working day is viewed, `getTodayData`
creates that day's task rows from those lists (`source = 'schedule'`). A unique index
(`uq_tasks_schedule_materialization`, migration 0005) makes this idempotent, so refreshing or opening the app on
two devices at once never duplicates tasks. Editing a block only affects tasks created from then on.

Unfinished schedule tasks are **not** carried to the next day (the Closing block's "Review unfinished tasks"
covers that). Unfinished *manual* tasks are carried, so a forgotten high-priority task can still show up overdue.

## The recommendation rules — `getNextRecommendedTask()`

First match wins. Every result includes a plain-language `reason`.

| # | Rule | Result |
|---|------|--------|
| 1 | An active order is **urgent**: overdue, or due within 3 hours today (`URGENT_ORDER_WINDOW_MINUTES`) | The order (overdue first, then earliest due) |
| 2 | An open task with priority ≥ 2 is **overdue** (scheduled earlier, or its time today has passed) | That task |
| 3 | A task is already **in progress** | Finish it |
| 4 | The current schedule block has unfinished tasks | Its next task: in-progress → not started → paused, then today's priorities, then priority, then order |
| 4b | The current block has *no tasks at all* (e.g. Break) | Reported as such — no invented work |
| 5 | An unfinished "today's priority" task exists | That task |
| 6 | An inventory item is at/below its reorder level | "Reorder X" (furthest below its level first) |
| 7 | Otherwise | The next block, or "Today's plan is complete" |

**Orders with no time set** (or due on a later day) are listed but never "urgent". Completed and cancelled
orders are ignored.

**When an order is urgent**, the Today screen puts it at the top, and the normal block card is dimmed with
"Order first". Nothing is deleted or reordered — the tasks are untouched and waiting.

## Task controls

Start / Complete / Pause / Skip update `tasks.status`. Starting a task automatically pauses any other
in-progress task, so "the current task" is never ambiguous. Completing an order also completes any task linked to
it (`tasks.order_id`) and logs `order_completed` to `business_activity_logs`.

## Today's three priorities

Stored as tasks with `daily_priority_rank` 1–3 (one per rank per day, enforced by a unique index).
Suggestions are rules, not AI: orders due today, overdue high-priority tasks, and low stock — minus anything
already chosen.

## Inventory status thresholds

`ok` → `low` (within 50% above the reorder level — a V1 default, `LOW_STOCK_BUFFER`) → `reorder`
(quantity ≤ reorder level, per the spec) → `out_of_stock` (≤ 0). Only `reorder` and `out_of_stock` raise alerts.

## Known limits (deliberate, for later phases)

- Orders can't be *created* yet — the Orders module is Phase 3. The Today screen already reads and advances them.
- Sales tiles arrive with the Sales module (Phase 3); the Closing "record revenue/orders/waste" form too.
- There is no offline write queue. Offline, the app stays readable and tells you changes can't be saved.
