-- ============================================================================
-- 0002_indexes.sql
-- Every business-scoped table is filtered by business_id on almost every
-- query, so that's indexed everywhere. Additional indexes support the
-- specific lookups the analytics/service layer performs (date ranges,
-- status filters, joins).
-- ============================================================================

create index idx_business_members_business_id on business_members(business_id);
create index idx_business_members_user_id on business_members(user_id);

create index idx_schedule_blocks_business_id on schedule_blocks(business_id);

create index idx_tasks_business_id on tasks(business_id);
create index idx_tasks_status on tasks(business_id, status);
create index idx_tasks_scheduled_date on tasks(business_id, scheduled_date);
create index idx_tasks_order_id on tasks(order_id) where order_id is not null;

create index idx_customers_business_id on customers(business_id);
create index idx_customers_phone on customers(business_id, phone);

create index idx_products_business_id on products(business_id);
create index idx_products_active on products(business_id, is_active);

create index idx_product_costs_product_id on product_costs(product_id);
create index idx_product_costs_current on product_costs(product_id) where effective_to is null;

create index idx_orders_business_id on orders(business_id);
create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_required_date on orders(business_id, required_date);
create index idx_orders_status on orders(business_id, status);

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_product_id on order_items(product_id);

create index idx_sales_business_date on sales(business_id, sale_date);

create index idx_inventory_items_business_id on inventory_items(business_id);

create index idx_inventory_transactions_item_date
  on inventory_transactions(inventory_item_id, transaction_date);
create index idx_inventory_transactions_business_id on inventory_transactions(business_id);

create index idx_content_items_business_id on content_items(business_id);
create index idx_content_items_date on content_items(business_id, content_date);

create index idx_goals_business_id on goals(business_id);
create index idx_goals_active_range on goals(business_id, start_date, end_date);

create index idx_daily_reviews_business_date on daily_reviews(business_id, review_date);

create index idx_activity_logs_business_id on business_activity_logs(business_id, created_at desc);
