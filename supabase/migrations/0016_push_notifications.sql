-- ============================================================================
-- 0016_push_notifications.sql
--
-- Phone notifications (web push) for three events:
--   low_stock        an inventory item drops to its reorder level or runs out
--   order_due        an order is due in 2 days (daily job, /api/cron/order-reminders)
--   schedule_change  a daily-schedule block is added, removed, turned on/off
--                    or its times change
--
-- push_subscriptions: one row per device that turned notifications on. The
-- endpoint is unique per browser install; signing in as someone else on the
-- same phone moves the row to that person.
--
-- notification_preferences: which of the three each person wants. No row
-- means "all on" (the defaults below), so nobody has to save before they
-- start receiving.
--
-- Sending and saving go through the server with the service-role key (the
-- server has to read everyone's subscriptions to notify the team). The own-row
-- policies below are only so a signed-in client can never see anyone else's.
-- ============================================================================

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

create index idx_push_subscriptions_business on push_subscriptions(business_id);
create index idx_push_subscriptions_user on push_subscriptions(user_id);

create trigger trg_push_subscriptions_updated_at
  before update on push_subscriptions
  for each row execute function set_updated_at();

alter table push_subscriptions enable row level security;

create policy "people can see their own devices"
  on push_subscriptions for select
  using (user_id = auth.uid());

create policy "people can remove their own devices"
  on push_subscriptions for delete
  using (user_id = auth.uid());

create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  low_stock boolean not null default true,
  order_due boolean not null default true,
  schedule_change boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_notification_preferences_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

alter table notification_preferences enable row level security;

create policy "people can see their own notification preferences"
  on notification_preferences for select
  using (user_id = auth.uid());

-- The due date an order's 2-day reminder was sent for. Moving the due date
-- makes it differ again, so the order is reminded for its new date.
alter table orders add column due_reminder_sent_for date;

comment on column orders.due_reminder_sent_for is 'required_date the "due in 2 days" push reminder was sent for (null = not yet).';
