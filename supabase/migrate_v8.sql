-- Roost — migration v8: multi-family support (real login + per-household data)
--
-- Run this ONCE in the Supabase SQL Editor. This is the FIRST of two steps —
-- see migrate_v8_cutover.sql for the second, which you run after signing up
-- for real through the app. Splitting it this way means nothing breaks for
-- existing (anon, not-yet-signed-in) use between the two steps: this file
-- only *adds* things — a nullable `household_id` on every table, a couple of
-- new tables, and a sign-up trigger — it doesn't touch the existing "allow
-- all to anon" policies at all. Safe to run more than once.
--
-- Until you also run migrate_v8_cutover.sql, the app keeps working exactly
-- as it does today (single shared household, no login required). Don't open
-- sign-up to a second family until the cutover step is done.

-- ---------------------------------------------------------------------------
-- households / profiles — one household per family, one profile per Supabase
-- Auth user linking them to their household.
-- ---------------------------------------------------------------------------

create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Family',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table households enable row level security;
alter table profiles   enable row level security;

drop policy if exists "read own household" on households;
create policy "read own household" on households
  for select to authenticated
  using (id in (select household_id from profiles where id = auth.uid()));

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
  for select to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- current_household_id() — the signed-in user's household, looked up once
-- and reused in every other table's policy below (and as every table's
-- household_id column default, so client inserts don't need to set it
-- explicitly — see useAppStore.ts's syncInsert, which never has, and still
-- won't need to).
-- ---------------------------------------------------------------------------

create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user() — runs inside the same transaction as the auth.users
-- insert on sign-up, so a household+profile is created atomically with the
-- account itself (there's no window where a signed-up user has no
-- household). The household name comes from the client's
-- `supabase.auth.signUp({ options: { data: { household_name } } })` call.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name)
    values (coalesce(new.raw_user_meta_data->>'household_name', 'My Family'))
    returning id into new_household_id;
  insert into public.profiles (id, household_id) values (new.id, new_household_id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- household_id on every existing table — nullable for now (this step only;
-- migrate_v8_cutover.sql backfills + sets NOT NULL + swaps the RLS policy).
-- `replica identity full` is required so Realtime's RLS check on UPDATE/
-- DELETE events actually has household_id available — by default a table's
-- replica identity is primary-key-only columns, which wouldn't include it.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['family_members','chores','meals','board_columns','board_items','calendar_events','recipes','meal_suggestions','app_lock']
  loop
    execute format('alter table %I add column if not exists household_id uuid references households(id) default current_household_id();', t);
    execute format('alter table %I replica identity full;', t);
  end loop;
end $$;
