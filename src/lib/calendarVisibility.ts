import { CalendarEvent, SubscribedCalendar } from '../store/types';
import { googleCalIdFor } from './googleCalendar';

/** Everything the visibility check needs from the settings store. */
export type CalendarToggles = {
  google: { connected: boolean; enabled?: boolean };
  apple: { connected: boolean; enabled?: boolean };
  subscribedCalendars: SubscribedCalendar[];
  /** Google calendar ids (raw calendarList ids) hidden individually — on top
   * of, not instead of, the master `google.enabled` switch. */
  hiddenGoogleCalendarIds: string[];
};

/**
 * Whether an event's *calendar* is currently switched on. This is separate
 * from the per-person visibility filter — it's about the Google / iCloud /
 * subscribed-calendar toggles (both the master switches in Settings and the
 * per-Google-calendar chips on the Calendar screen).
 *
 * `enabled` is treated as on when undefined (older stored state).
 */
export function isEventCalendarEnabled(e: CalendarEvent, t: CalendarToggles): boolean {
  if (e.source === 'google') {
    if (!t.google.connected || t.google.enabled === false) return false;
    const gcalId = googleCalIdFor(e.calendarId) ?? 'primary';
    return !t.hiddenGoogleCalendarIds.includes(gcalId);
  }
  if (e.source === 'apple') return t.apple.connected && t.apple.enabled !== false;
  if (e.source === 'subscription') {
    const sub = t.subscribedCalendars.find((c) => `sub:${c.id}` === e.calendarId);
    return !!sub && sub.enabled;
  }
  return true; // 'local' — always shown (even if its target calendar is off)
}
