-- Roost — migration v9: in-app feedback box
--
-- Run this ONCE in the Supabase SQL Editor. Adds a `feedback` table that the
-- Help screen's "Send feedback" box writes to.
--
-- No email/push notification service involved on purpose — check for new
-- feedback anytime with:
--
--   select f.message, f.created_at, h.name as household
--   from feedback f
--   join households h on h.id = f.household_id
--   order by f.created_at desc;
--
-- New-family signups don't need a new table at all — they're already
-- visible in households/profiles (created by migrate_v8.sql's
-- handle_new_user() trigger). Check for new families with:
--
--   select h.name, h.created_at, u.email
--   from households h
--   join profiles p on p.household_id = h.id
--   join auth.users u on u.id = p.id
--   order by h.created_at desc;

create table if not exists feedback (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default current_household_id() references households(id) on delete cascade,
  message      text not null,
  created_at   timestamptz not null default now()
);

alter table feedback enable row level security;

drop policy if exists "household isolation" on feedback;
create policy "household isolation" on feedback
  for all to authenticated
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
