-- Roost — migration v6: app-wide PIN lock (Settings → App Lock)
--
-- Run this ONCE in the Supabase SQL Editor if your project already has the
-- other tables and you don't want to re-run the whole schema.sql.
--
-- Adds a single-row table holding a SHA-256 hash of the shared PIN. No row =
-- no PIN configured = the app opens with no gate, so this migration alone
-- doesn't lock anyone out — nothing changes until someone sets a PIN in
-- Settings. Safe to run more than once.

create table if not exists app_lock (
  id       text primary key,
  pin_hash text not null
);

alter table app_lock enable row level security;

drop policy if exists "allow all to anon" on app_lock;
create policy "allow all to anon" on app_lock for all to anon using (true) with check (true);

alter publication supabase_realtime add table app_lock;
