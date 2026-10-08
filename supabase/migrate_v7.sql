-- Roost — migration v7: ambient screensaver photo storage
--
-- Run this ONCE in the Supabase SQL Editor if your project already has the
-- other tables and you don't want to re-run the whole schema.sql.
--
-- Creates a public Storage bucket for uploaded family photos (used by the
-- ambient screensaver slideshow — see Settings → Screensaver) and an "allow
-- all to anon" policy on it, consistent with every other table's RLS in this
-- app (see the security note in schema.sql). Safe to run more than once.

insert into storage.buckets (id, name, public)
values ('family-photos', 'family-photos', true)
on conflict (id) do nothing;

drop policy if exists "allow all to anon on family-photos" on storage.objects;
create policy "allow all to anon on family-photos" on storage.objects
  for all to anon
  using (bucket_id = 'family-photos')
  with check (bucket_id = 'family-photos');
