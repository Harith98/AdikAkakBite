-- 0006_customer_name_index.sql  (Phase 3A)
-- Orders find-or-create a customer by name (case-insensitive) within a business.
create index if not exists idx_customers_business_name on customers (business_id, lower(name));
