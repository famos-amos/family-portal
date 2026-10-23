import { CalendarEvent, GoogleAccount } from '../store/types';
import { googleCalIdFor } from './googleCalendar';
import { personColorOptions } from '../theme/colors';

/**
 * The color to draw a Google-sourced event with, in priority order:
 *   1. the user's override for that calendar (set from the color-swatch
 *      picker on its chip) — keyed `${accountId}:${calId}` so two accounts'
 *      same-named calendars never share an override.
 *   2. Google's own color for it (calendarList's backgroundColor)
 *   3. the same palette color its legend chip falls back to (indexed by
 *      position across *every* connected account's calendars, flattened in
 *      account order — not restarted per account, so two accounts' lists
 *      don't both start at the same color) so an event always matches its
 *      chip even when Google hasn't returned a color for that calendar
 *   4. undefined if the calendar isn't in any account's `calendars` at all
 *      (e.g. an old event whose calendar list hasn't loaded yet) —
 *      caller's own fallback (e.g. `theme.colors.inkSoft`) applies.
 *
 * Returns undefined outright for non-Google events — those are colored by
 * attendee elsewhere and this function has nothing to add.
 */
export function eventCalendarColor(
  e: Pick<CalendarEvent, 'source' | 'calendarId'>,
  googleAccounts: GoogleAccount[] | undefined,
  overrides: Record<string, string>,
): string | undefined {
  if (e.source !== 'google') return undefined;
  const parsed = googleCalIdFor(e.calendarId);
  if (!parsed) return undefined;
  const compositeKey = `${parsed.accountId}:${parsed.calId}`;
  if (overrides[compositeKey]) return overrides[compositeKey];
  const flattened = (googleAccounts ?? []).flatMap((a) =>
    (a.calendars ?? []).map((cal) => ({ accountId: a.id, cal })),
  );
  const idx = flattened.findIndex((f) => f.accountId === parsed.accountId && f.cal.id === parsed.calId);
  if (idx === -1) return undefined;
  return flattened[idx].cal.color || personColorOptions[idx % personColorOptions.length];
}
