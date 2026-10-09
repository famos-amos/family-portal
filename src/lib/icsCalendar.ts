// Subscribed public calendars (view-only).
//
// Fetches an ICS / webcal feed and parses its VEVENTs into the app's event
// shape. Almost no ICS feed sends CORS headers, so on the web build the fetch
// goes through the `ics-proxy` Supabase Edge Function; native tries the feed
// directly first and falls back to the proxy.
//
// Recurrence (RRULE) IS expanded (see expandRecurrence below) — covers the
// common real-world cases (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT,
// UNTIL, BYDAY including "2TU"/"-1FR" ordinals, BYMONTHDAY, EXDATE, RDATE).
// Deliberately NOT covered — these are rare outside enterprise scheduling
// tools, and any VEVENT using them just falls back to its single DTSTART
// occurrence rather than crashing or guessing: BYSETPOS, BYWEEKNO,
// BYYEARDAY, BYHOUR/BYMINUTE/BYSECOND, and SECONDLY/MINUTELY/HOURLY
// frequencies. Also: true per-instance timezone/DST correctness isn't
// attempted — same simplification parseIcsDate already made for a single
// occurrence, just carried through each generated one.
import { Platform } from 'react-native';
import { CalendarEvent } from '../store/types';
import { useCalendarStore, useSettingsStore } from '../store/useAppStore';
import { personColorOptions } from '../theme/colors';
import { parseClockTime } from './date';

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

function minutesToClockLabel(totalMinutes: number): string {
  const mins = ((totalMinutes % 1440) + 1440) % 1440; // wrap into a single day
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function ymdToIso(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return ymdToIso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

// 0 = Sunday, matching Date#getDay() / the rest of this file's convention.
const BYDAY_WEEKDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** "2TU" -> 2nd Tuesday, "-1FR" -> last Friday, "WE" -> any/every Wednesday
 * (no ordinal — used by WEEKLY's BYDAY). */
function parseByDayToken(token: string): { ord: number | null; weekday: number } | null {
  const m = token.trim().toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
  if (!m) return null;
  return { ord: m[1] ? parseInt(m[1], 10) : null, weekday: BYDAY_WEEKDAY[m[2]] };
}

/** Day-of-month (1-based) of the `ord`-th `weekday` in `year`/`month`, or
 * null if that occurrence doesn't exist (e.g. a 5th Monday most months). */
function nthWeekdayOfMonth(year: number, month1to12: number, weekday: number, ord: number): number | null {
  if (ord > 0) {
    const firstWeekday = new Date(year, month1to12 - 1, 1).getDay();
    const day = 1 + ((weekday - firstWeekday + 7) % 7) + (ord - 1) * 7;
    return day <= daysInMonth(year, month1to12) ? day : null;
  }
  if (ord < 0) {
    const dim = daysInMonth(year, month1to12);
    const lastWeekday = new Date(year, month1to12 - 1, dim).getDay();
    const day = dim - ((lastWeekday - weekday + 7) % 7) + (ord + 1) * 7;
    return day >= 1 ? day : null;
  }
  return null;
}

type RRuleDict = Record<string, string>;

function parseRRule(value: string): RRuleDict {
  const out: RRuleDict = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return out;
}

// Hard safety caps — a feed with no COUNT/UNTIL (recurs "forever") is still
// bounded by the window below, but these stop a malformed rule (e.g.
// INTERVAL=0) from looping effectively forever before it gets there.
const MAX_OCCURRENCES = 1000;
const MAX_ITERATIONS = 5000;

/** Expands one VEVENT's RRULE into every occurrence's {date, time} within
 * [minIso, maxIso], in the event's own local time-of-day. Falls back to just
 * `dtstart` for any FREQ this doesn't implement (see this file's header). */
function expandRecurrence(
  dtstart: { date: string; time?: string },
  rrule: RRuleDict,
  exDates: Set<string>,
  rDates: string[],
  minIso: string,
  maxIso: string,
): { date: string; time?: string }[] {
  const freq = (rrule.FREQ ?? '').toUpperCase();
  const interval = Math.max(1, parseInt(rrule.INTERVAL ?? '1', 10) || 1);
  const count = rrule.COUNT ? parseInt(rrule.COUNT, 10) : undefined;
  const until = rrule.UNTIL ? parseIcsDate(rrule.UNTIL)?.date : undefined;
  const [startY, startM, startD] = dtstart.date.split('-').map(Number);

  const withinBound = (iso: string) => iso <= maxIso && (!until || iso <= until);

  const raw: string[] = [];
  const pushIfBounded = (iso: string) => {
    if (withinBound(iso)) raw.push(iso);
  };

  if (freq === 'DAILY') {
    let iso = dtstart.date;
    // Jump close to the visible window instead of iterating one day at a
    // time from DTSTART — without this, a years-old DAILY series with no
    // COUNT/UNTIL could burn through MAX_ITERATIONS before ever reaching
    // `minIso`. Skipped only when COUNT is set, since COUNT means "the Nth
    // occurrence from the true DTSTART", which a jump would miscount.
    if (count == null && iso < minIso) {
      const daysBetween = Math.floor((Date.parse(minIso) - Date.parse(iso)) / 86400000);
      const steps = Math.floor(daysBetween / interval);
      if (steps > 0) iso = addDaysIso(iso, steps * interval);
    }
    for (let i = 0; i < MAX_ITERATIONS && raw.length < MAX_OCCURRENCES && withinBound(iso); i++) {
      raw.push(iso);
      iso = addDaysIso(iso, interval);
    }
  } else if (freq === 'WEEKLY') {
    const byDay = (rrule.BYDAY ?? '')
      .split(',')
      .map(parseByDayToken)
      .filter((x): x is { ord: number | null; weekday: number } => !!x);
    const weekdays = byDay.length ? byDay.map((b) => b.weekday) : [new Date(startY, startM - 1, startD).getDay()];
    let weekStartIso = addDaysIso(dtstart.date, -new Date(startY, startM - 1, startD).getDay()); // Sunday of dtstart's week
    for (let i = 0; i < MAX_ITERATIONS && raw.length < MAX_OCCURRENCES && weekStartIso <= maxIso; i++) {
      for (const wd of weekdays) {
        const occ = addDaysIso(weekStartIso, wd);
        if (occ >= dtstart.date) pushIfBounded(occ);
      }
      weekStartIso = addDaysIso(weekStartIso, interval * 7);
    }
    raw.sort();
  } else if (freq === 'MONTHLY') {
    const byMonthDay = (rrule.BYMONTHDAY ?? '')
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n));
    const byDay = (rrule.BYDAY ?? '').split(',').map(parseByDayToken).filter((x): x is { ord: number; weekday: number } => !!x && x.ord != null);
    let totalMonths = (startY * 12 + (startM - 1));
    for (let i = 0; i < MAX_ITERATIONS && raw.length < MAX_OCCURRENCES; i++, totalMonths += interval) {
      const year = Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      const monthStartIso = ymdToIso(year, month, 1);
      if (monthStartIso > maxIso) break;
      const days: number[] = byMonthDay.length
        ? byMonthDay.map((n) => (n < 0 ? daysInMonth(year, month) + n + 1 : n)).filter((d) => d >= 1 && d <= daysInMonth(year, month))
        : byDay.length
        ? byDay.map((b) => nthWeekdayOfMonth(year, month, b.weekday, b.ord)).filter((d): d is number => d != null)
        : [startD <= daysInMonth(year, month) ? startD : -1].filter((d) => d > 0);
      for (const d of days) {
        const occ = ymdToIso(year, month, d);
        if (occ >= dtstart.date) pushIfBounded(occ);
      }
    }
    raw.sort();
  } else if (freq === 'YEARLY') {
    let year = startY;
    for (let i = 0; i < MAX_ITERATIONS && raw.length < MAX_OCCURRENCES; i++, year += interval) {
      if (startM === 2 && startD === 29 && daysInMonth(year, 2) < 29) continue; // skip non-leap years for a Feb 29 anniversary
      const occ = ymdToIso(year, startM, startD);
      if (occ > maxIso) break;
      pushIfBounded(occ);
    }
  } else {
    // Unrecognized/unsupported FREQ — single occurrence, same as no RRULE.
    return withinBound(dtstart.date) && dtstart.date >= minIso ? [dtstart] : [];
  }

  for (const r of rDates) if (withinBound(r)) raw.push(r);

  const deduped = Array.from(new Set(raw)).sort();
  const limited = typeof count === 'number' ? deduped.slice(0, count) : deduped;
  return limited.filter((iso) => iso >= minIso && !exDates.has(iso)).map((date) => ({ date, time: dtstart.time }));
}

export function parseIcs(
  ics: string,
  opts: { fromDaysAgo?: number; toDaysAhead?: number } = {},
): ParsedIcsEvent[] {
  const minIso = new Date(Date.now() - (opts.fromDaysAgo ?? 7) * 86400000).toISOString().slice(0, 10);
  const maxIso = new Date(Date.now() + (opts.toDaysAhead ?? 120) * 86400000).toISOString().slice(0, 10);

  const out: ParsedIcsEvent[] = [];
  let cur: Record<string, string> | null = null;
  let exDateLines: string[] = [];
  let rDateLines: string[] = [];

  const flush = () => {
    if (!cur?.['DTSTART']) return;
    const start = parseIcsDate(cur['DTSTART']);
    if (!start) return;
    const end = cur['DTEND'] ? parseIcsDate(cur['DTEND']) : null;
    const title = cur['SUMMARY'] ? unescapeIcsText(cur['SUMMARY']) : '(untitled event)';
    // Same-day duration, reapplied to each generated occurrence's own date —
    // a recurring event's end time should track its start time, not stay
    // pinned to the DTSTART day.
    const durationMinutes =
      end && end.date === start.date && start.time && end.time
        ? (() => {
            const s = parseClockTime(start.time!);
            const e = parseClockTime(end.time!);
            return s != null && e != null ? e - s : null;
          })()
        : null;

    const occurrences = cur['RRULE']
      ? expandRecurrence(
          start,
          parseRRule(cur['RRULE']),
          new Set(
            exDateLines.flatMap((v) => v.split(',')).map((v) => parseIcsDate(v)?.date).filter((d): d is string => !!d),
          ),
          rDateLines.flatMap((v) => v.split(',')).map((v) => parseIcsDate(v)?.date).filter((d): d is string => !!d),
          minIso,
          maxIso,
        )
      : start.date >= minIso && start.date <= maxIso
      ? [start]
      : [];

    for (const occ of occurrences) {
      out.push({
        date: occ.date,
        time: occ.time,
        endTime: durationMinutes != null && occ.time ? minutesToClockLabel(parseClockTime(occ.time)! + durationMinutes) : undefined,
        title,
      });
    }
  };

  for (const line of unfoldLines(ics)) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      exDateLines = [];
      rDateLines = [];
      continue;
    }
    if (line === 'END:VEVENT') {
      flush();
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (key === 'DTSTART' || key === 'DTEND' || key === 'SUMMARY' || key === 'RRULE') cur[key] = value;
    else if (key === 'EXDATE') exDateLines.push(value);
    else if (key === 'RDATE') rDateLines.push(value);
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
