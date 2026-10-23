import { AppleAccount, CalendarEvent, GoogleAccount, SubscribedCalendar } from '../store/types';
import { googleCalIdFor } from './googleCalendar';

/** Everything the visibility check needs from the settings store. */
export type CalendarToggles = {
  googleAccounts: Pick<GoogleAccount, 'id' | 'enabled'>[];
  appleAccounts: Pick<AppleAccount, 'id' | 'enabled'>[];
  subscribedCalendars: SubscribedCalendar[];
  /** `${googleAccountId}:${googleCalId}` composite keys hidden individually
   * — on top of, not instead of, that account's own `enabled` switch. */
  hiddenGoogleCalendarIds: string[];
};

/**
 * Whether an event's *calendar* is currently switched on. This is separate
 * from the per-person visibility filter — it's about the Google / iCloud /
 * subscribed-calendar toggles (both each account's master switch in
 * Settings and the per-Google-calendar toggles on the Calendar screen).
 *
 * Deliberately does NOT require *this device* to be connected to that
 * account: events already pulled into the shared Supabase table are real
 * data for the whole household, not just the one device that happened to
 * run the OAuth flow. An account's `enabled` switch still gates whether
 * *new* writes get pushed (see googleCalendar.ts's `googleWritable()`) and
 * whether that account is offered as a target for new events — just not
 * whether already-synced events are visible. For the same reason, an event
 * whose account has since been disconnected/removed entirely falls through
 * to "visible" rather than hidden — removing an account isn't a request to
 * also hide everything it already synced.
 */
export function isEventCalendarEnabled(e: CalendarEvent, t: CalendarToggles): boolean {
  if (e.source === 'google') {
    const parsed = googleCalIdFor(e.calendarId);
    if (!parsed) return true;
    const account = t.googleAccounts.find((a) => a.id === parsed.accountId);
    if (account && !account.enabled) return false;
    return !t.hiddenGoogleCalendarIds.includes(`${parsed.accountId}:${parsed.calId}`);
  }
  if (e.source === 'apple') {
    const accountId = e.calendarId?.startsWith('apple:') ? e.calendarId.slice('apple:'.length) : null;
    const account = accountId ? t.appleAccounts.find((a) => a.id === accountId) : undefined;
    return !account || account.enabled;
  }
  if (e.source === 'subscription') {
    const sub = t.subscribedCalendars.find((c) => `sub:${c.id}` === e.calendarId);
    return !!sub && sub.enabled;
  }
  return true; // 'local' — always shown (even if its target calendar is off)
}
