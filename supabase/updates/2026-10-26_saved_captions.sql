-- ============================================================================
-- 2026-10-26_saved_captions.sql — schema version 3 → 4
--
-- Saved captions on the Content page: write a caption (or a hashtag set) once,
-- copy it in one tap whenever you post. Shared with the whole team. The most
-- used ones are listed first (use_count, last_used_at).
--
-- Run once in the Supabase SQL Editor (after 2026-10-26_catalogue_opens.sql). Running it twice is refused, changing nothing.
-- ============================================================================

-- Guard: refuses (and changes nothing) if this update is already applied, or
-- if the update before it hasn't been run. The whole file is one transaction.
do $guard$
declare
  v_version integer := case when to_regprocedure('public.schema_version()') is null then 0 else schema_version() end;
begin
  if v_version >= 4 then
    raise exception 'Already done: this database is at version %, and this file is version 4. Nothing was changed.', v_version;
  end if;
  if v_version < 3 then
    raise exception 'Run the earlier update files first: this database is at version %, and this file needs version 3. Nothing was changed.', v_version;
  end if;
end;
$guard$;

create table if not exists saved_captions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  body text not null,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_captions_title_length check (length(title) between 1 and 60),
  constraint saved_captions_body_length check (length(body) between 1 and 2200)
);
comment on table saved_captions is 'Reusable captions and hashtag sets for posting (Content page).';

create index if not exists idx_saved_captions_business on saved_captions(business_id);

drop trigger if exists set_updated_at on saved_captions;
create trigger set_updated_at before update on saved_captions
  for each row execute function set_updated_at();

alter table saved_captions enable row level security;
drop policy if exists "members can access their saved captions" on saved_captions;
create policy "members can access their saved captions"
  on saved_captions for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create or replace function schema_version()
returns integer
language sql
immutable
as $$
  select 4;
$$;

select schema_version() as schema_version; -- should say 4
