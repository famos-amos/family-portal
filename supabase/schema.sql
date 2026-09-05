-- FamilyPortal — Supabase schema
--
-- Run this once in your Supabase project's SQL Editor (Supabase dashboard →
-- SQL Editor → New query → paste this whole file → Run). See README.md →
-- "Setting up Supabase" for the full walkthrough.
--
-- This is a *single shared household* app — there's no per-person login,
-- so every table is readable/writable by the app's anon (public) key. RLS
-- is still turned on with explicit "allow all" policies (rather than left
-- off) so the intent is on record and easy to tighten later. Because the
-- anon key ships inside the web bundle, anyone who finds your app's URL and
-- opens devtools can read it and, in principle, read/write your data too —
-- fine for a private family app whose GitHub Pages URL isn't shared or
-- indexed, but don't treat this as a substitute for real auth if that
-- matters to you later (Supabase Auth + per-row `owner` policies is the
-- upgrade path).
--
-- If you already ran an earlier version of this file (meals.chef_id /
-- calendar_events.person_id as single text columns), do NOT just re-run
-- this file — `create table if not exists` won't alter an existing table's
-- columns, so your existing tables would keep the old single-person
-- columns and the app (which now expects chef_ids/person_ids arrays) would
-- see them as empty. Run `supabase/migrate_multi_person.sql` once instead —
-- it converts your existing data in place and is safe to run exactly once.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists family_members (
  id        text primary key,
  name      text not null,
  birthday  text,              -- ISO date "YYYY-MM-DD", nullable
  color     text not null,
  initials  text not null
);

create table if not exists chores (
  id           text primary key,
  title        text not null,
  assignee_id  text references family_members(id) on delete set null,
  points       integer not null default 0,
  done         boolean not null default false
);

create table if not exists meals (
  id        text primary key,
  day       text not null,       -- 'mon'..'sun'
  slot      text not null,       -- 'breakfast' | 'lunch' | 'dinner'
  name      text not null,
  chef_ids  text[] not null default '{}',  -- zero or more family_members.id — no FK on array columns, so referential integrity here is enforced by the app, not the database
  notes     text,
  rating    integer               -- 0-5, nullable
);

create table if not exists board_columns (
  id     text primary key,
  title  text not null,
  color  text not null
);

create table if not exists board_items (
  id           text primary key,
  column_id    text not null references board_columns(id) on delete cascade,
  title        text not null,
  description  text,
  owner_id     text references family_members(id) on delete set null,
  done         boolean not null default false
);

create table if not exists calendar_events (
  id          text primary key,
  date        text not null,      -- ISO date "YYYY-MM-DD"
  time        text,                -- e.g. "9:00 AM", nullable = all-day
  title       text not null,
  person_ids  text[] not null default '{}',  -- zero or more family_members.id — see note on meals.chef_ids above
  source      text not null default 'local'  -- 'local' | 'google' | 'apple'
);

-- ---------------------------------------------------------------------------
-- Row Level Security — open to the app's anon key (see note above)
-- ---------------------------------------------------------------------------

alter table family_members  enable row level security;
alter table chores          enable row level security;
alter table meals           enable row level security;
alter table board_columns   enable row level security;
alter table board_items     enable row level security;
alter table calendar_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['family_members','chores','meals','board_columns','board_items','calendar_events']
  loop
    execute format('drop policy if exists "allow all to anon" on %I;', t);
    execute format(
      'create policy "allow all to anon" on %I for all to anon using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime — lets every open tablet/phone see changes from the others live.
-- If this errors with "relation is already member of publication", that's
-- fine, it just means it's already on (or turn tables on individually from
-- Database → Replication in the dashboard instead of running this block).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table family_members;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table meals;
alter publication supabase_realtime add table board_columns;
alter publication supabase_realtime add table board_items;
alter publication supabase_realtime add table calendar_events;

-- ---------------------------------------------------------------------------
-- Starter data — same starter family/chores/meals/boards the app used to
-- ship with locally, so the app isn't empty on first load. Safe to re-run —
-- existing rows are left alone. Feel free to delete all of this later from
-- inside the app (Settings → Family Members, and each screen's own delete
-- controls) once your real family data is in.
-- ---------------------------------------------------------------------------

insert into family_members (id, name, color, initials, birthday) values
  ('mom',  'Mom',  '#D98CA6', 'M',  '1988-04-12'),
  ('dad',  'Dad',  '#7FA8D9', 'D',  '1986-11-03'),
  ('milo', 'Milo', '#5FB8A8', 'Mi', '2016-06-28'),
  ('kaya', 'Kaya', '#E3A94C', 'K',  '2018-02-15')
on conflict (id) do nothing;

insert into chores (id, title, assignee_id, points, done) values
  ('c1', 'Sweep the porch',      null,   2, false),
  ('c2', 'Water the plants',     null,   1, false),
  ('c3', 'Take out trash',       'milo', 1, true),
  ('c4', 'Do the dishes',        'milo', 2, false),
  ('c5', 'Feed the cat',         'kaya', 1, true),
  ('c6', 'Make bed',             'kaya', 1, true),
  ('c7', 'Fold laundry',         'kaya', 2, false),
  ('c8', 'Plan grocery list',    'mom',  0, false),
  ('c9', 'Pay bills',            'dad',  0, false)
on conflict (id) do nothing;

insert into meals (id, day, slot, name, chef_ids, rating, notes) values
  ('m1',  'mon', 'lunch',  'Leftovers',              array['dad'],         null, null),
  ('m2',  'tue', 'lunch',  'Grilled Cheese',          array['milo'],       null, null),
  ('m3',  'thu', 'lunch',  'Turkey Sandwiches',       array['mom'],        null, null),
  ('m4',  'fri', 'lunch',  'Pizza Slices',            array['dad'],        null, null),
  ('m5',  'sun', 'lunch',  'Pancake Brunch',          array['mom'],        null, null),
  ('m6',  'mon', 'dinner', 'Taco Night',              array['kaya'],       null, null),
  ('m7',  'tue', 'dinner', 'BBQ Chicken',             array['dad'],        null, null),
  ('m8',  'wed', 'dinner', 'Homemade Pizza',          array['milo'],       null, null),
  ('m9',  'thu', 'dinner', 'Veggie Stir-fry',         array['mom'],        null, null),
  ('m10', 'fri', 'dinner', 'Grilled Salmon',          array['dad'],        null, null),
  ('m11', 'sat', 'dinner', 'Roast & Veggies',         array['mom'],        null, null),
  ('m12', 'sun', 'dinner', 'Spaghetti & Meatballs',   array['mom','dad'],  4,    'Double the recipe — Milo''s friend is staying over for dinner.')
on conflict (id) do nothing;

insert into board_columns (id, title, color) values
  ('todo',     'Family To-Do',  '#3D6FA8'),
  ('wishlist', 'Wishlist',      '#7A5AA6'),
  ('shopping', 'Shopping List', '#2E7A4D')
on conflict (id) do nothing;

insert into board_items (id, column_id, title, description, owner_id, done) values
  ('b1', 'todo',     'Schedule dentist appointments', null,                          'mom',  false),
  ('b2', 'todo',     'Fix leaky faucet',               null,                          'dad',  false),
  ('b3', 'todo',     'Return Amazon package',          null,                          'kaya', false),
  ('b4', 'wishlist', 'Nintendo Switch game',           'Mario Kart — for birthday',   'milo', false),
  ('b5', 'wishlist', 'Roller skates',                  'Pink ones from the mall',     'kaya', false),
  ('b6', 'shopping', 'Milk',                           null,                          'mom',  false),
  ('b7', 'shopping', 'AA batteries',                   null,                          'dad',  false),
  ('b8', 'shopping', 'Poster board',                   'For the school project',      'milo', false)
on conflict (id) do nothing;

-- Calendar events are seeded with fixed offsets from *today as of running
-- this script* rather than the app's original relative-to-launch-day seed
-- data (that logic lived in client code) — feel free to delete/edit these
-- from the Calendar screen once you've run the schema.
insert into calendar_events (id, date, time, title, person_ids, source) values
  ('e1', (current_date - (extract(day from current_date)::int - 5))::text,  null,      'Beach day',            array['dad'],                       'local'),
  ('e2', (current_date - (extract(day from current_date)::int - 15))::text, null,      'Business trip',        array['dad'],                       'local'),
  ('e3', current_date::text,                                                '9:00 AM', 'Soccer practice',      array['milo'],                      'local'),
  ('e4', current_date::text,                                                '3:30 PM', 'Dentist appointment',  array['kaya'],                      'local'),
  ('e5', current_date::text,                                                '6:00 PM', 'Family dinner',        array['dad','mom','milo','kaya'],   'local'),
  ('e6', (current_date + 1)::text,                                          null,      'Book club',            array['mom'],                       'local'),
  ('e7', (current_date + 3)::text,                                          null,      'Piano lesson',         array['kaya'],                      'local')
on conflict (id) do nothing;