-- ============================================================================
-- 0021_editable_sale_date.sql
--
-- Lets a sale be dated in the past:
--   * recording a past sale: an order inserted already completed keeps the
--     completed_on the app gives it (the New Order form's "past sale" option);
--   * correcting a date: completed_on can be changed on a completed order
--     (e.g. it was handed over yesterday but marked complete today).
-- Marking an order completed normally still stamps today, as before (0015).
-- A sale date can't be in the future.
--
-- Recording a past sale does NOT touch ready stock or ingredients: those
-- triggers run when an order *becomes* completed by an update, and a past
-- sale shouldn't change what's on the shelf today.
-- ============================================================================

create or replace function set_order_completed_on()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (
    now() at time zone coalesce(
      (select timezone from business_settings where business_id = new.business_id),
      'Asia/Kuala_Lumpur'
    )
  )::date;
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' then
      new.completed_on := coalesce(new.completed_on, v_today);   -- a past sale keeps its date
    elsif old.status is distinct from 'completed' then
      new.completed_on := v_today;                                -- completed just now
    elsif new.completed_on is null then
      new.completed_on := coalesce(old.completed_on, v_today);    -- never lose the date
    end if;                                                       -- otherwise: keep / accept an edited date
    if new.completed_on > v_today then
      raise exception 'The sale date can''t be in the future.';
    end if;
  else
    new.completed_on := null;
  end if;
  return new;
end;
$$;
