-- ============================================================================
-- 0008_member_admin_role.sql
--
-- Adds an 'admin' member role between 'owner' and 'staff'. Kept in its own
-- migration because Postgres won't let a new enum value be USED in the same
-- transaction that adds it — 0009 relies on it.
--
--   owner — everything, including managing admins
--   admin — business settings, daily schedule, and managing staff
--   staff — day-to-day work (Today, orders, products, inventory, customers, sales)
-- ============================================================================

alter type business_member_role add value if not exists 'admin' before 'staff';
