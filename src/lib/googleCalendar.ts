// Google Calendar 2-way sync.
//
// Auth uses `expo-auth-session`'s Google provider with the **authorization
// code flow** (`response_type=code`) plus `access_type=offline` — that's the
// only flow that yields a **refresh token**, which is what lets the app keep
// syncing (pull new events, push local ones) without the family having to
// re-authorise in a browser every time. The implicit token flow
// (`response_type=token`) can't do offline access at all.
//
// Redeeming the code differs by platform:
//   • Native build — the provider auto-exchanges the code against the
//                    iOS/Android OAuth client. Installed-app clients don't use
//                    a client secret, so this happens entirely on-device.
//   • Web build    — a "Web application" OAuth client's code exchange REQUIRES
//                    the client secret, which must never ship in a browser
//                    bundle. So the web build POSTs the code to a tiny backend
//                    (a Supabase Edge Function, `supabase/functions/google-oauth`)
//                    that holds the secret and returns the tokens. See
//                    README.md → "Offline sync / refresh tokens".
//
// Client IDs come from app.json's `expo.extra` block (see README.md "Google
// Calendar setup"). Until they're filled in, `isGoogleConfigured()` is false
// and the Settings screen shows a setup prompt instead of the Connect button.
//
// NOTE: Google sign-in does not work from Expo Go on SDK 50+ (the auth proxy
// that used to bridge it was removed) — use the web build or a dev build.
import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { CalendarEvent, GoogleCalendarSummary } from '../store/types';
import { useSettingsStore } from '../store/useAppStore';
import { parseClockTime } from './date';

// calendar.events covers reading/writing *events*; listing the account's own
// calendars (calendarList.list — used to build the Work/Personal/School
// picker) is a separate scope and 403s without it, even with calendar.events
// granted.
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function extraConfig(): Record<string, string> {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
}

/** Returns the id only if it's a real value — not the `REPLACE_WITH_...`
 * placeholder that ships in app.json. */
function realId(id?: string): string | undefined {
  return id && !id.startsWith('REPLACE_WITH_') ? id : undefined;
}

/** The per-platform *native* client id (Android or iOS). Used for the
 * on-device refresh call, which installed-app clients can make without a
 * secret. `undefined` on web. */
function nativeClientId(): string | undefined {
  const e = extraConfig();
  if (Platform.OS === 'ios') return realId(e.googleOAuthClientIdIos);
  if (Platform.OS === 'android') return realId(e.googleOAuthClientIdAndroid);
  return undefined;
}

export function isGoogleConfigured(): boolean {
  const e = extraConfig();
  const webId = realId(e.googleOAuthClientIdWeb);
  if (Platform.OS === 'ios') return !!(realId(e.googleOAuthClientIdIos) || webId);
  if (Platform.OS === 'android') return !!(realId(e.googleOAuthClientIdAndroid) || webId);
  return !!webId; // web + Expo Go both use the Web client
}

export function useGoogleAuthRequest() {
  const e = extraConfig();
  // Pass '' (not undefined) for any id that's missing — the provider throws on
  // `undefined`, and the Connect button is gated on isGoogleConfigured() so
  // promptAsync() never actually runs while a needed id is absent.
  const result = Google.useAuthRequest({
    webClientId: realId(e.googleOAuthClientIdWeb) ?? '',
    iosClientId: realId(e.googleOAuthClientIdIos) ?? '',
    androidClientId: realId(e.googleOAuthClientIdAndroid) ?? '',
    scopes: SCOPES,
    responseType: ResponseType.Code,
    // `offline` asks for a refresh token; `consent` forces Google to actually
    // return one every time (it otherwise only does so on the very first
    // authorisation for a given user + client).
    extraParams: { access_type: 'offline', prompt: 'consent' },
    // Native installed-app clients can redeem the code on-device with no
    // secret, so let the provider do it. The web build can't (secret needed),
    // so it keeps the raw code and hands it to the backend below.
    shouldAutoExchangeCode: Platform.OS !== 'web',
  });

  // "Error 400: invalid_request / flowName=GeneralOAuthFlow" from Google almost
  // always means the exact `redirect_uri` below is not listed under this exact
  // client's **Authorized redirect URIs** (localhost is NOT auto-allowed for
  // Web clients), or the client id is not a "Web application" type. Log both so
  // there's no guessing what to register.
  const request = result[0];
  useEffect(() => {
    if (__DEV__ && request) {
      // eslint-disable-next-line no-console
      console.log(
        `[google] client_id in use: ${request.clientId}\n` +
          `[google] register this EXACT value as an Authorized redirect URI ` +
          `(and its origin as an Authorized JavaScript origin) on that client: ${request.redirectUri}`,
      );
    }
  }, [request?.clientId, request?.redirectUri]);

  return result;
}

// ---------------------------------------------------------------------------
// Token exchange / refresh
// ---------------------------------------------------------------------------

export type GoogleTokens = {
  accessToken: string;
  /** Absent on a refresh response — the original refresh token stays valid. */
  refreshToken?: string;
  /** Epoch ms at which `accessToken` stops working. */
  expiresAt: number;
};

/** URL of the backend that holds the Web client secret and talks to Google's
 * token endpoint. Explicit override wins; otherwise the bundled Supabase Edge
 * Function is assumed at `<supabase-url>/functions/v1/google-oauth`. */
function tokenProxyUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_GOOGLE_TOKEN_PROXY;
  if (explicit) return explicit.replace(/\/$/, '');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/functions/v1/google-oauth`;
  throw new Error(
    'Google needs a backend to exchange the auth code on web. Set EXPO_PUBLIC_GOOGLE_TOKEN_PROXY, ' +
      'or EXPO_PUBLIC_SUPABASE_URL so the bundled google-oauth Edge Function is used. ' +
      'See README.md → "Offline sync / refresh tokens".',
  );
}

async function callTokenProxy(payload: Record<string, string>): Promise<GoogleTokens> {
  // Sent as a CORS "simple request": `text/plain` content type and no custom
  // headers, so the browser skips the preflight OPTIONS entirely. (The Edge
  // Function must still be deployed with `--no-verify-jwt` so an
  // unauthenticated POST is allowed through — see README.) The function parses
  // the body as JSON regardless of the declared content type.
  const url = tokenProxyUrl();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(
      `Could not reach the Google token backend at ${url} — ${String(err)}. ` +
        'Deploy it with: supabase functions deploy google-oauth --no-verify-jwt',
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token proxy error: ${res.status} ${json?.error ?? JSON.stringify(json)}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

/** Redeem the authorization `code` from a web sign-in for tokens (native does
 * this itself inside the provider). */
export async function exchangeGoogleCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  return callTokenProxy({ action: 'exchange', ...args });
}

/** Trade a refresh token for a fresh access token. Native hits Google
 * directly (installed-app clients need no secret); web goes through the
 * backend. */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = nativeClientId();
  if (Platform.OS !== 'web' && clientId) {
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Google token refresh failed: ${res.status} ${json?.error ?? ''}`);
    }
    return {
      accessToken: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
  }
  return callTokenProxy({ action: 'refresh', refreshToken });
}

/** Returns a usable access token for the Calendar API, refreshing (and
 * persisting the result) if the stored one is missing or within 60s of
 * expiry. Throws if Google was never connected. */
export async function getFreshGoogleAccessToken(): Promise<string> {
  const { google, setGoogleAuth } = useSettingsStore.getState();
  if (google.accessToken && google.expiresAt && google.expiresAt - Date.now() > 60_000) {
    return google.accessToken;
  }
  if (!google.refreshToken) {
    throw new Error('Google Calendar is not connected — sign in from Settings first.');
  }
  const t = await refreshGoogleAccessToken(google.refreshToken);
  setGoogleAuth({
    accessToken: t.accessToken,
    expiresAt: t.expiresAt,
    ...(t.refreshToken ? { refreshToken: t.refreshToken } : {}),
  });
  return t.accessToken;
}

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
};

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

/** `google:<id>` (or the legacy bare `'google'`) → the Google calendar id.
 * Anything else → null. */
export function googleCalIdFor(calendarId?: string | null): string | null {
  if (!calendarId) return null;
  if (calendarId === 'google') return 'primary';
  if (calendarId.startsWith('google:')) return calendarId.slice('google:'.length) || 'primary';
  return null;
}

function throwForCalendarStatus(status: number, body: string): never {
  if (status === 401) throw new Error('Google access token was rejected (401). Reconnect from Settings.');
  if (status === 403) {
    throw new Error(
      `Google refused the request (403). Enable the Google Calendar API on the project, and make sure ` +
        `both the calendar.events AND calendar.readonly scopes are added on the OAuth consent screen, ` +
        `then reconnect (Disconnect + Connect) so a fresh token actually has them. Details: ${body}`,
    );
  }
  throw new Error(`Google Calendar API error: ${status} ${body}`);
}

/** The calendars in the connected account. `writable` ones can be picked as a
 * target for new events. */
export async function fetchGoogleCalendarList(accessToken: string): Promise<GoogleCalendarSummary[]> {
  // `colorRgbFormat=true` is required or Google omits backgroundColor/
  // foregroundColor entirely (it only returns a palette-index `colorId`
  // otherwise) — without it every calendar's `color` here was undefined.
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&colorRgbFormat=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throwForCalendarStatus(res.status, await res.text());
  const json = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      summaryOverride?: string;
      primary?: boolean;
      accessRole?: string;
      deleted?: boolean;
      backgroundColor?: string;
    }[];
  };
  return (json.items ?? [])
    .filter((c) => !c.deleted)
    .map((c) => ({
      id: c.id,
      summary: c.summaryOverride || c.summary || c.id,
      primary: !!c.primary,
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
      color: c.backgroundColor,
    }));
}

function mapGoogleEvent(e: GoogleEvent, calId: string): CalendarEvent {
  const dateTime = e.start?.dateTime ?? e.start?.date ?? new Date().toISOString();
  const d = new Date(dateTime);
  return {
    id: `google_${calId}_${e.id}`,
    googleId: e.id,
    date: e.start?.dateTime
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : d.toISOString().slice(0, 10),
    time: e.start?.dateTime
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : undefined,
    title: e.summary ?? '(untitled event)',
    personIds: [],
    source: 'google',
    calendarId: `google:${calId}`,
  };
}

/** Pulls upcoming events from every given calendar (id list, e.g. from
 * fetchGoogleCalendarList). Each event is tagged with its `google:<id>`. */
export async function fetchGoogleEvents(
  accessToken: string,
  calendarIds: string[] = ['primary'],
  daysAhead = 60,
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const query =
    `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=2500`;

  const perCalendar = await Promise.all(
    calendarIds.map(async (calId) => {
      const res = await fetch(`${CAL_BASE}/${encodeURIComponent(calId)}/events${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        // eslint-disable-next-line no-console
        console.error(`[google] GET ${calId}/events -> ${res.status}`, body);
        // One unreadable calendar shouldn't sink the whole sync.
        if (res.status === 401) throwForCalendarStatus(res.status, body);
        return [] as CalendarEvent[];
      }
      const json = (await res.json()) as { items?: GoogleEvent[] };
      return (json.items ?? []).map((e) => mapGoogleEvent(e, calId));
    }),
  );
  const all = perCalendar.flat();
  // eslint-disable-next-line no-console
  console.log(`[google] fetched ${all.length} event(s) across ${calendarIds.length} calendar(s)`);
  return all;
}

// ---------------------------------------------------------------------------
// Writing events back to Google (the "push" half of 2-way sync)
// ---------------------------------------------------------------------------

const eventsUrl = (calId: string) => `${CAL_BASE}/${encodeURIComponent(calId)}/events`;

/** ISO timestamp for a "YYYY-MM-DD" + free-text clock ("3:30 PM"). */
function isoAt(dateStr: string, clock?: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const mins = clock ? parseClockTime(clock) : null;
  const dt =
    mins != null ? new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60) : new Date(y, m - 1, d);
  return dt.toISOString();
}

/** The Google Calendar API request body for one of our events. */
function googleEventBody(event: Pick<CalendarEvent, 'title' | 'date' | 'time' | 'endTime'>) {
  if (event.time) {
    const startIso = isoAt(event.date, event.time);
    const endIso = event.endTime
      ? isoAt(event.date, event.endTime)
      : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    return { summary: event.title, start: { dateTime: startIso }, end: { dateTime: endIso } };
  }
  // All-day: Google's `end.date` is exclusive, so it's the day after.
  const [y, m, d] = event.date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
    next.getDate(),
  ).padStart(2, '0')}`;
  return { summary: event.title, start: { date: event.date }, end: { date: nextIso } };
}

/** Creates the event on `calId`; returns its Google event id. */
export async function createGoogleEvent(
  accessToken: string,
  calId: string,
  event: CalendarEvent,
): Promise<string> {
  const res = await fetch(eventsUrl(calId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(googleEventBody(event)),
  });
  if (!res.ok) throw new Error(`Google create failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

/** Updates an already-mirrored event on `calId`. */
export async function patchGoogleEvent(
  accessToken: string,
  calId: string,
  googleId: string,
  event: CalendarEvent,
): Promise<void> {
  const res = await fetch(`${eventsUrl(calId)}/${encodeURIComponent(googleId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(googleEventBody(event)),
  });
  if (!res.ok) throw new Error(`Google update failed: ${res.status} ${await res.text()}`);
}

/** Deletes a mirrored event from `calId`. 404/410 (already gone) is success. */
export async function deleteGoogleEvent(
  accessToken: string,
  calId: string,
  googleId: string,
): Promise<void> {
  const res = await fetch(`${eventsUrl(calId)}/${encodeURIComponent(googleId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google delete failed: ${res.status} ${await res.text()}`);
  }
}

/** Moves an event between calendars in the same account (keeps its id). */
export async function moveGoogleEvent(
  accessToken: string,
  fromCalId: string,
  toCalId: string,
  googleId: string,
): Promise<void> {
  const res = await fetch(
    `${eventsUrl(fromCalId)}/${encodeURIComponent(googleId)}/move?destination=${encodeURIComponent(toCalId)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Google move failed: ${res.status} ${await res.text()}`);
}

/** True when events can currently be written to Google (connected, a refresh
 * token on hand, and the toggle in Settings left on). */
function googleWritable(): boolean {
  const g = useSettingsStore.getState().google;
  return !!g.connected && g.enabled !== false && !!g.refreshToken;
}

/** Mirrors a newly-created event to the Google calendar named by `calendarId`
 * (`google:<id>`); returns its Google id, or null if Google isn't
 * connected/enabled or `calendarId` isn't a Google one. */
export async function mirrorNewEventToGoogle(
  event: CalendarEvent,
  calendarId: string | null | undefined,
): Promise<string | null> {
  const calId = googleCalIdFor(calendarId);
  if (!calId || !googleWritable()) return null;
  return createGoogleEvent(await getFreshGoogleAccessToken(), calId, event);
}

/** Pushes an edit to the event's mirrored Google copy on its own calendar
 * (no-op if it has no googleId / isn't a Google event / Google is off). */
export async function pushEventEditToGoogle(event: CalendarEvent): Promise<void> {
  const calId = googleCalIdFor(event.calendarId);
  if (!event.googleId || !calId || !googleWritable()) return;
  await patchGoogleEvent(await getFreshGoogleAccessToken(), calId, event.googleId, event);
}

/** Deletes the event's mirrored Google copy from `calendarId` (no-op if
 * Google is off). */
export async function deleteEventFromGoogle(
  calendarId: string | null | undefined,
  googleId: string,
): Promise<void> {
  const calId = googleCalIdFor(calendarId);
  if (!calId || !googleWritable()) return;
  await deleteGoogleEvent(await getFreshGoogleAccessToken(), calId, googleId);
}

/** Moves an already-mirrored event from one Google calendar to another. */
export async function moveEventBetweenGoogleCalendars(
  fromCalendarId: string | null | undefined,
  toCalendarId: string | null | undefined,
  googleId: string,
): Promise<boolean> {
  const from = googleCalIdFor(fromCalendarId);
  const to = googleCalIdFor(toCalendarId);
  if (!from || !to || from === to || !googleWritable()) return false;
  await moveGoogleEvent(await getFreshGoogleAccessToken(), from, to, googleId);
  return true;
}