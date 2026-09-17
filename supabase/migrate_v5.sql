-- Roost — migration v5: per-event target calendar + subscribed public calendars
--
-- Run this ONCE in the Supabase SQL Editor if your project already has the
-- other tables and you don't want to re-run the whole schema.sql.
--
-- It only adds two nullable columns to calendar_events:
--   calendar_id  'local' | 'google' | 'apple' | 'sub:<subscribed calendar id>'
--   google_id    the event's id on Google Calendar, once it's been mirrored there
--
-- No new tables, no RLS or realtime changes (calendar_events is already
-- covered). Existing rows are untouched. Safe to run more than once.

alter table calendar_events add column if not exists calendar_id text;
alter table calendar_events add column if not exists google_id   text;
