-- Roost — migration v8, step 2: cutover to per-household data isolation
--
-- Run this ONCE, and only after:
--   1. You've run migrate_v8.sql.
--   2. You (the existing family) have signed up for real through the app's
--      new sign-in screen — this creates your own household + profile.
--
-- This is the step that actually turns on isolation: it backfills all of
-- your EXISTING data (created before any of this existed) onto the
-- household your sign-up just created, then locks every table down to
-- "only the signed-in household can see its own rows". Don't run this until
-- you've actually signed up — there's nothing to backfill onto yet.
--
-- Before running: replace YOUR_EMAIL_HERE below with the email you just
-- signed up with. Everything else runs as one transaction, so it either
-- fully applies or fully rolls back — no in-between state.
--
-- Don't open sign-up to a second family until this has run successfully —
-- not because of a data-leak risk (RLS fails closed; an unrelated household
-- would see nothing either way), but because there's no reason to let
-- anyone else in mid-migration.

begin;

do $$
declare
  t text;
  my_household_id uuid;
begin
  select household_id into my_household_id
  from public.profiles
  where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

  if my_household_id is null then
    raise exception 'No household found for that email — did you sign up through the app first, and is the email exactly right?';
  end if;

  foreach t in array array['family_members','chores','meals','board_columns','board_items','calendar_events','recipes','meal_suggestions','app_lock']
  loop
    -- Backfill: every row that predates this migration (household_id still
    -- null) belongs to this one existing family.
    execute format('update %I set household_id = %L where household_id is null;', t, my_household_id);

    -- Lock the column down now that every row has a value.
    execute format('alter table %I alter column household_id set not null;', t);

    -- Swap from "anyone with the anon key" to "only your own household,
    -- and only once signed in".
    execute format('drop policy if exists "allow all to anon" on %I;', t);
    execute format('drop policy if exists "household isolation" on %I;', t);
    execute format(
      'create policy "household isolation" on %I for all to authenticated using (household_id = current_household_id()) with check (household_id = current_household_id());',
      t
    );
  end loop;
end $$;

commit;
