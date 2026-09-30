-- ============================================================================
-- 0012_customer_phone_key.sql
--
-- Customers are now identified by phone number first, name second (see
-- src/lib/customer-identity.ts). phone_key is the phone reduced to a
-- comparable form, so "012-345 6789", "+60 12 345 6789" and "0060123456789"
-- all become "60123456789":
--   digits only → "00…" loses the 00 → a leading "0" becomes "60…"
--
-- It MUST stay identical to normalizePhone() in customer-identity.ts.
-- A generated column means it can never drift from `phone`, whichever
-- client writes the row.
--
-- Deliberately NOT unique: existing data may already hold two customer rows
-- with the same number. The app prevents new duplicates; merging old ones is
-- a manual clean-up.
-- ============================================================================

alter table customers
  add column phone_key text generated always as (
    nullif(
      case
        when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '00%'
          then substr(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 3)
        when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '0%'
          then '60' || substr(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 2)
        else regexp_replace(coalesce(phone, ''), '\D', '', 'g')
      end,
      ''
    )
  ) stored;

comment on column customers.phone_key is 'Normalised phone (digits, Malaysian 0… → 60…) used to identify customers. Generated from phone.';

create index idx_customers_phone_key on customers(business_id, phone_key) where phone_key is not null;

-- Superseded: lookups now go through phone_key.
drop index if exists idx_customers_phone;
