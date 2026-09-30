-- ============================================================================
-- 0011_receipts.sql
--
-- Receipts for completed orders:
--   * businesses gets the contact details a standard receipt shows
--   * orders gets a per-business sequential receipt number, when it was
--     issued, and how the customer paid
--   * issue_order_receipt() hands out the next number safely
--
-- Receipt numbers are assigned once and never change or get reused, even if
-- the order is later reopened — a gap-free, stable sequence per business is
-- what makes a receipt number trustworthy.
-- ============================================================================

alter table businesses
  add column phone text check (length(phone) <= 30),
  add column email text check (length(email) <= 200),
  add column address text check (length(address) <= 300),
  add column registration_number text check (length(registration_number) <= 50),
  add column receipt_footer text check (length(receipt_footer) <= 300);

comment on column businesses.registration_number is 'Company/SSM registration number, printed on receipts if set.';
comment on column businesses.receipt_footer is 'Custom closing line on receipts, e.g. a thank-you or return policy.';

alter table orders
  add column receipt_number integer check (receipt_number > 0),
  add column receipt_issued_at timestamptz,
  add column payment_method text check (
    payment_method in ('cash', 'bank_transfer', 'duitnow_qr', 'card', 'ewallet', 'other')
  );

create unique index idx_orders_receipt_number
  on orders(business_id, receipt_number) where receipt_number is not null;

-- Issues (or, if already issued, returns) the receipt number for a completed
-- order. SECURITY INVOKER: runs as the caller, so RLS still decides which
-- orders they can touch. A per-business advisory lock serialises numbering,
-- so two receipts issued at the same moment can't get the same number.
create or replace function issue_order_receipt(p_order_id uuid, p_payment_method text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  o orders;
  next_number integer;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception 'That order could not be found.';
  end if;
  if o.status <> 'completed' then
    raise exception 'Only completed orders can have a receipt.';
  end if;

  if o.receipt_number is not null then
    update orders set payment_method = coalesce(p_payment_method, payment_method) where id = o.id;
    return o.receipt_number;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('receipt:' || o.business_id::text, 0));

  select coalesce(max(receipt_number), 0) + 1 into next_number
  from orders
  where business_id = o.business_id;

  update orders
  set receipt_number = next_number,
      receipt_issued_at = now(),
      payment_method = p_payment_method
  where id = o.id;

  return next_number;
end;
$$;

revoke all on function issue_order_receipt(uuid, text) from public;
grant execute on function issue_order_receipt(uuid, text) to authenticated;
