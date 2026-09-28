-- ============================================================================
-- 0005_task_priorities_and_ordering.sql  (Phase 2: Daily operations)
--
--  * daily_priority_rank: marks a task as one of "today's three priorities"
--    (spec §10). At most one task per rank per business per day.
--  * sort_order: stable ordering of tasks inside a schedule block.
--  * A unique index used to materialise each day's schedule tasks safely:
--    the Today screen creates the day's tasks from each block's default_tasks
--    on first view, and this index makes that idempotent even if two requests
--    race. It is deliberately NOT a partial index so PostgREST's upsert
--    (ON CONFLICT) can target it. Manual tasks have a NULL schedule_block_id,
--    and NULLs never conflict in a unique index, so they are unaffected.
-- ============================================================================

alter table tasks
  add column daily_priority_rank smallint,
  add column sort_order smallint not null default 0,
  add constraint tasks_daily_priority_rank_range
    check (daily_priority_rank is null or daily_priority_rank between 1 and 3);

create unique index uq_tasks_daily_priority
  on tasks (business_id, scheduled_date, daily_priority_rank)
  where daily_priority_rank is not null;

create unique index uq_tasks_schedule_materialization
  on tasks (business_id, scheduled_date, schedule_block_id, title);
