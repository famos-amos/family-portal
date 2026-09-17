import { CalendarEvent, GoogleCalendarSummary } from '../store/types';
import { googleCalIdFor } from './googleCalendar';
import { personColorOptions } from '../theme/colors';

/**
 * The color to draw a Google-sourced event with, in priority order:
 *   1. the user's override for that calendar (set from the color-swatch
 *      picker on its chip)
 *   2. Google's own color for it (calendarList's backgroundColor)
 *   3. the same palette color its legend chip falls back to (indexed by
 *      position in `googleCalendars`, matching the Calendar screen's chip
 *      row exactly) so an event always matches its chip even when Google
 *      hasn't returned a color for that calendar
 *   4. undefined if the calendar isn't in `googleCalendars` at all (e.g. an
 *      old event whose calendar list hasn't loaded yet) — caller's own
 *      fallback (e.g. `theme.colors.inkSoft`) applies.
 *
 * Returns undefined outright for non-Google events — those are colored by
 * attendee elsewhere and this function has nothing to add.
 */
export function eventCalendarColor(
  e: Pick<CalendarEvent, 'source' | 'calendarId'>,
  googleCalendars: GoogleCalendarSummary[] | undefined,
  overrides: Record<string, string>,
): string | undefined {
  if (e.source !== 'google') return undefined;
  const gcalId = googleCalIdFor(e.calendarId) ?? 'primary';
  if (overrides[gcalId]) return overrides[gcalId];
  const idx = (googleCalendars ?? []).findIndex((c) => c.id === gcalId);
  if (idx === -1) return undefined;
  return googleCalendars![idx].color || personColorOptions[idx % personColorOptions.length];
}
