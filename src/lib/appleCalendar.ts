// Apple/iCloud Calendar 2-way sync via CalDAV (RFC 4791).
//
// Unlike Google, Apple has no OAuth "Calendar API" for third-party apps —
// the standard integration path is CalDAV against iCloud's servers, using
// the user's Apple ID email + an *app-specific password* (generated at
// appleid.apple.com → Sign-In and Security → App-Specific Passwords).
// That credential is entered once in Settings and stored with expo-secure-store
// (device keychain / EncryptedSharedPreferences) — never sent anywhere but
// Apple's own servers.
//
// IMPORTANT: this file implements the protocol calls per Apple/RFC 4791 docs,
// but this sandbox has no way to exercise them against a real iCloud account
// or network, so treat it as a solid first draft that needs verification on
// a real device with a real Apple ID before you rely on it. See README.md.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CalendarEvent } from '../store/types';

const CREDENTIAL_KEY = 'roost.appleCalendarCredentials';
const PRINCIPAL_URL = 'https://caldav.icloud.com/';

export type AppleCredentials = { appleId: string; appSpecificPassword: string };

// expo-secure-store has no device keychain on web (there isn't one) — its web
// build is a no-op stub. Fall back to localStorage there. It's not as safe as
// a native keychain, but it matches what any browser-based app can offer, and
// this only ever runs on the tablet's own browser.
async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveAppleCredentials(creds: AppleCredentials): Promise<void> {
  await storageSet(CREDENTIAL_KEY, JSON.stringify(creds));
}

export async function loadAppleCredentials(): Promise<AppleCredentials | null> {
  const raw = await storageGet(CREDENTIAL_KEY);
  return raw ? (JSON.parse(raw) as AppleCredentials) : null;
}

export async function clearAppleCredentials(): Promise<void> {
  await storageDelete(CREDENTIAL_KEY);
}

function authHeader(creds: AppleCredentials): string {
  const basic = `${creds.appleId}:${creds.appSpecificPassword}`;
  // btoa is available in Hermes/RN's JS runtime.
  return `Basic ${btoa(basic)}`;
}

async function propfind(url: string, creds: AppleCredentials, body: string, depth: '0' | '1' = '0'): Promise<string> {
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: authHeader(creds),
      Depth: depth,
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body,
  });
  if (!res.ok && res.status !== 207) {
    throw new Error(`CalDAV PROPFIND ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

/**
 * Follows Apple's documented CalDAV bootstrap: discover the principal, then
 * the calendar-home-set, then the list of calendar collection URLs.
 * Returns the calendar-home URL (where events actually live) on success.
 */
export async function discoverCalendarHome(creds: AppleCredentials): Promise<string> {
  const principalBody = `<?xml version="1.0" encoding="utf-8"?>
    <D:propfind xmlns:D="DAV:">
      <D:prop><D:current-user-principal/></D:prop>
    </D:propfind>`;
  const principalXml = await propfind(PRINCIPAL_URL, creds, principalBody);
  const principalHref = extractTagValue(principalXml, 'href');
  if (!principalHref) throw new Error('Could not discover Apple ID principal — check your Apple ID and app-specific password.');

  const homeBody = `<?xml version="1.0" encoding="utf-8"?>
    <C:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop><C:calendar-home-set/></D:prop>
    </C:propfind>`;
  const homeXml = await propfind(new URL(principalHref, PRINCIPAL_URL).toString(), creds, homeBody);
  const homeHref = extractTagValue(homeXml, 'href');
  if (!homeHref) throw new Error('Could not discover Apple calendar home.');

  return new URL(homeHref, PRINCIPAL_URL).toString();
}

/** Very small, deliberately-limited XML value extractor — good enough for the single-value lookups above. */
function extractTagValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<[^:>]*:?${tag}[^>]*>([^<]+)</[^:>]*:?${tag}>`, 'i'));
  return match ? match[1] : null;
}

/** Fetches events in the given date range from every calendar under `calendarHome`. */
export async function fetchAppleEvents(
  creds: AppleCredentials,
  calendarHome: string,
  daysAhead = 60,
): Promise<CalendarEvent[]> {
  const start = icsDate(new Date());
  const end = icsDate(new Date(Date.now() + daysAhead * 86400000));

  const reportBody = `<?xml version="1.0" encoding="utf-8"?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop><D:getetag/><C:calendar-data/></D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VEVENT">
            <C:time-range start="${start}" end="${end}"/>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

  const res = await fetch(calendarHome, {
    method: 'REPORT',
    headers: {
      Authorization: authHeader(creds),
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: reportBody,
  });
  if (!res.ok && res.status !== 207) {
    throw new Error(`CalDAV REPORT failed: ${res.status} ${await res.text()}`);
  }
  const xml = await res.text();
  return parseIcsEventsFromMultistatus(xml);
}

/** Pushes a locally-created event to iCloud as a new VEVENT. */
export async function pushEventToApple(creds: AppleCredentials, calendarHome: string, event: CalendarEvent): Promise<void> {
  const uid = `roost-${event.id}@roostapp`;
  const dt = event.time ? new Date(`${event.date} ${event.time}`) : new Date(`${event.date}T00:00:00`);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roost//Family Portal//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(dt)}`,
    `SUMMARY:${event.title}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  const res = await fetch(`${calendarHome}${uid}.ics`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(creds),
      'Content-Type': 'text/calendar; charset=utf-8',
    },
    body: ics,
  });
  if (!res.ok) {
    throw new Error(`CalDAV PUT failed: ${res.status} ${await res.text()}`);
  }
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function parseIcsEventsFromMultistatus(xml: string): CalendarEvent[] {
  const blocks = xml.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  return blocks.map((block, i) => {
    const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim() ?? '(untitled event)';
    const dtstart = block.match(/DTSTART[^:]*:(\d{8}T?\d{0,6})/)?.[1] ?? '';
    const year = dtstart.slice(0, 4);
    const month = dtstart.slice(4, 6);
    const day = dtstart.slice(6, 8);
    const date = year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
    return {
      id: `apple_${i}_${dtstart}`,
      date,
      title: summary,
      personIds: [],
      source: 'apple' as const,
    };
  });
}