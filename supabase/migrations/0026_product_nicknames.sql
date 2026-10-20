-- ============================================================================
-- 0026_product_nicknames.sql
--
-- Other names customers use for a product ("batik klasik", "kek batik"), so
-- an order pasted from WhatsApp matches the right product even when the
-- customer doesn't write its exact name. Up to 10, set in the product form.
-- ============================================================================

alter table products
  add column nicknames text[] not null default '{}';

comment on column products.nicknames is 'Other names customers use; matched by the WhatsApp paste reader.';
