-- ============================================================================
-- seed_demo_data.sql — OPTIONAL demo data (spec §49)
--
-- This is NOT run automatically by migrations. Run it manually only if you
-- want sample products/orders to explore the app with. Every row's `notes`
-- field is prefixed "[DEMO]" so the app's "Delete demo data" action
-- (Settings) can find and remove them by that marker.
--
-- Usage:
--   1. Replace :business_id below with a real business id (from the
--      businesses table, after you've signed up and completed onboarding).
--   2. Run this file against your Supabase database.
-- ============================================================================

-- psql variable — set this before running, e.g.:
--   psql "$DATABASE_URL" -v business_id="'00000000-0000-0000-0000-000000000000'" -f seed_demo_data.sql
\set business_id '''00000000-0000-0000-0000-000000000000'''

insert into products (business_id, name, category, description, selling_price, notes)
values
  (:business_id, 'Brownie Box', 'Brownies', 'Box of 6 fudgy brownies', 25.00, '[DEMO]'),
  (:business_id, 'Classic Cheesecake', 'Cheesecake', 'Whole 6-inch baked cheesecake', 45.00, '[DEMO]'),
  (:business_id, 'Cookie Jar', 'Cookies', 'Jar of 12 assorted cookies', 18.00, '[DEMO]'),
  (:business_id, 'Dessert Box', 'Mixed', 'Mixed mini-dessert sampler box', 30.00, '[DEMO]');

insert into product_costs (product_id, ingredient_cost, packaging_cost, other_cost)
select id, 8.50, 2.00, 1.00 from products where business_id = :business_id and name = 'Brownie Box';
insert into product_costs (product_id, ingredient_cost, packaging_cost, other_cost)
select id, 15.00, 3.00, 1.50 from products where business_id = :business_id and name = 'Classic Cheesecake';
insert into product_costs (product_id, ingredient_cost, packaging_cost, other_cost)
select id, 5.00, 1.50, 0.50 from products where business_id = :business_id and name = 'Cookie Jar';
insert into product_costs (product_id, ingredient_cost, packaging_cost, other_cost)
select id, 9.00, 2.50, 1.00 from products where business_id = :business_id and name = 'Dessert Box';

insert into inventory_items (business_id, name, category, current_quantity, unit, reorder_level, unit_cost, supplier, notes)
values
  (:business_id, 'Chocolate (dark, 70%)', 'Baking', 3, 'kg', 2, 32.00, 'Local Cocoa Supplier', '[DEMO]'),
  (:business_id, 'Cream Cheese', 'Dairy', 4, 'kg', 3, 18.00, 'Dairy Distributor', '[DEMO]'),
  (:business_id, 'Takeaway Boxes (6")', 'Packaging', 40, 'pcs', 30, 0.90, 'Packaging Supplier', '[DEMO]');

insert into customers (business_id, name, phone, notes)
values
  (:business_id, 'Sarah Lim', '+60123456789', '[DEMO]'),
  (:business_id, 'Ahmad Faiz', '+60129876543', '[DEMO]');

-- Note: sample orders/sales are intentionally left out of this seed — they
-- are most useful once the Orders and Sales modules (Phase 3) exist to
-- display and edit them meaningfully.
