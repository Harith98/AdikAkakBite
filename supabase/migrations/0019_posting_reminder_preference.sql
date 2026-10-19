-- ============================================================================
-- 0019_posting_reminder_preference.sql
--
-- A fourth notification kind: the evening posting reminder. Sent by the daily
-- Vercel cron (/api/cron/posting-reminders, 12:00 UTC = 8pm Malaysia) when
-- today's posting checklist on the Content page isn't complete, naming the
-- platforms still to post and the streak at stake. On by default, like the others.
-- ============================================================================

alter table notification_preferences
  add column posting_reminder boolean not null default true;
