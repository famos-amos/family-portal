// Subscribed public calendars (view-only).
//
// Fetches an ICS / webcal feed and parses its VEVENTs into the app's event
// shape. Almost no ICS feed sends CORS headers, so on the web build the fetch
// goes through the `ics-proxy` Supabase Edge Function; native tries the feed
// directly first and falls back to the proxy.
//
// Recurrence (RRULE) is NOT expanded — each VEVENT contributes a single
// occurrence at its DTSTART. That's enough for one-off community / school /
// holiday calendars; fully recurring feeds will only show the first instance.
import { Platform } from 'react-native';
import { CalendarEvent } from '../store/types';
import { useCalendarStore, useSettingsStore } from '../store/useAppStore';
import { personColorOptions } from '../theme/colors';

export type ParsedIcsEvent = Pick<CalendarEvent, 'date' | 'time' | 'endTime' | 'title'>;

export function normaliseIcsUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//i, 'https://');
}

function icsProxyBase(): string | null {
  const explicit = process.env.EXPO_PUBLIC_ICS_PROXY;
  if (explicit) return explicit.replace(/\/$/, '');
  const supa = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return supa ? `${supa.replace(/\/$/, '')}/functions/v1/ics-proxy` : null;
}

/** Fetches the raw ICS text, going direct or via the proxy as needed. */
export async function fetchIcsText(url: string): Promise<string> {
  const direct = normaliseIcsUrl(url);
  const proxyBase = icsProxyBase();
  const proxied = proxyBase ? `${proxyBase}?url=${encodeURIComponent(direct)}` : null;

  // Web can't read a CORS-less feed at all — proxy only. Native: try direct,
  // then proxy.
  const attempts = Platform.OS === 'web' ? [proxied] : [direct, proxied];

  let lastErr: unknown = new Error('no fetch attempt was made');
  for (const target of attempts) {
    if (!target) continue;
    try {
      const res = await fetch(target, { headers: { Accept: 'text/calendar, text/plain, */*' } });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (text.includes('BEGIN:VCALENDAR')) return text;
      lastErr = new Error('that URL did not return an ICS calendar');
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `Couldn't load the calendar feed — ${String((lastErr as any)?.message ?? lastErr)}. ` +
      (proxied
        ? 'Make sure the ics-proxy Edge Function is deployed (supabase functions deploy ics-proxy --no-verify-jwt).'
        : 'Set EXPO_PUBLIC_SUPABASE_URL (or EXPO_PUBLIC_ICS_PROXY) so the feed can be fetched through a proxy.'),
  );
}

// RFC 5545: a CRLF followed by a space or tab is a folded line continuation.
function unfoldLines(ics: string): string[] {
  return ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescapeIcsText(v: string): string {
  return v
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/** Parses "20260907", "20260907T183000", "20260907T183000Z" → local date/time. */
function parseIcsDate(value: string): { date: string; time?: string } | null {
  const m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, , z] = m;
  if (hh == null) return { date: `${y}-${mo}-${d}` }; // all-day (VALUE=DATE)

  const local = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm))
    : new Date(+y, +mo - 1, +d, +hh, +mm);
  const iso = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
    local.getDate(),
  ).padStart(2, '0')}`;
  return { date: iso, time: local.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) };
}

export function parseIcs(
  ics: string,
  opts: { fromDaysAgo?: number; toDaysAhead?: number } = {},
): ParsedIcsEvent[] {
  const minIso = new Date(Date.now() - (opts.fromDaysAgo ?? 7) * 86400000).toISOString().slice(0, 10);
  const maxIso = new Date(Date.now() + (opts.toDaysAhead ?? 120) * 86400000).toISOString().slice(0, 10);

  const out: ParsedIcsEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const line of unfoldLines(ics)) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.['DTSTART']) {
        const start = parseIcsDate(cur['DTSTART']);
        if (start && start.date >= minIso && start.date <= maxIso) {
          const end = cur['DTEND'] ? parseIcsDate(cur['DTEND']) : null;
          out.push({
            date: start.date,
            time: start.time,
            endTime: end && end.date === start.date ? end.time : undefined,
            title: cur['SUMMARY'] ? unescapeIcsText(cur['SUMMARY']) : '(untitled event)',
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).split(';')[0].toUpperCase();
    if (key === 'DTSTART' || key === 'DTEND' || key === 'SUMMARY') cur[key] = line.slice(colon + 1);
  }

  return out;
}

export async function fetchSubscribedCalendarEvents(url: string): Promise<ParsedIcsEvent[]> {
  return parseIcs(await fetchIcsText(url));
}

/** Re-reads one subscribed calendar's feed and swaps its events into the
 * store. Returns the event count. Throws on a fetch/parse failure. */
export async function refreshSubscribedCalendar(subId: string): Promise<number> {
  const sub = useSettingsStore.getState().subscribedCalendars.find((c) => c.id === subId);
  if (!sub) return 0;
  const events = await fetchSubscribedCalendarEvents(sub.url);
  useCalendarStore.getState().replaceSubscribedEvents(subId, events);
  return events.length;
}

/** Refreshes every enabled subscribed calendar, swallowing per-feed errors so
 * one bad URL doesn't stop the rest. */
export async function refreshEnabledSubscribedCalendars(): Promise<void> {
  const subs = useSettingsStore.getState().subscribedCalendars.filter((c) => c.enabled);
  await Promise.all(
    subs.map((c) =>
      refreshSubscribedCalendar(c.id).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[ics] refresh of "${c.name}" failed —`, err);
      }),
    ),
  );
}

// --- Shared actions used by both the Calendar screen and Settings -----------

/** Adds a public calendar (auto-assigning a color) and loads its feed. On a
 * fetch failure the calendar entry is kept and the error re-thrown with a
 * `calendarId` property so the caller can decide whether to remove it. */
export async function addSubscribedCalendarFromLink(
  name: string,
  url: string,
): Promise<{ id: string; count: number }> {
  const s = useSettingsStore.getState();
  const color = personColorOptions[s.subscribedCalendars.length % personColorOptions.length];
  const cal = s.addSubscribedCalendar({ name: name.trim(), url: normaliseIcsUrl(url.trim()), color });
  try {
    return { id: cal.id, count: await refreshSubscribedCalendar(cal.id) };
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { calendarId: cal.id });
  }
}

export function removeSubscribedCalendarWithEvents(id: string): void {
  useSettingsStore.getState().removeSubscribedCalendar(id);
  useCalendarStore.getState().removeEventsForCalendar(`sub:${id}`);
}

/** Flips a subscribed calendar's on/off and, when turning it on, re-reads its
 * feed. */
export async function toggleSubscribedCalendarWithRefresh(id: string): Promise<void> {
  const s = useSettingsStore.getState();
  const wasEnabled = s.subscribedCalendars.find((c) => c.id === id)?.enabled;
  s.toggleSubscribedCalendar(id);
  if (!wasEnabled) {
    try {
      await refreshSubscribedCalendar(id);
    } catch {
      /* refreshSubscribedCalendar already logs; leaving it enabled is fine */
    }
  }
}
