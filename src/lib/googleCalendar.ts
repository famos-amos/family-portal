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
import { AuthRequest, ResponseType } from 'expo-auth-session';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { CalendarEvent, GoogleCalendarSummary } from '../store/types';
import { useCalendarStore, useProviderSyncStatusStore, useSettingsStore } from '../store/useAppStore';
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
  const result = Google.useAuthRequest(
    {
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
    },
    // Without this, makeRedirectUri() on web resolves to just the bare
    // origin (e.g. https://famos-amos.github.io) — not wherever this app is
    // actually hosted (e.g. .../family-portal, this repo's GitHub Pages
    // path). Google would then redirect back to a URL nothing is served at
    // (a 404) after a successful sign-in, so the app never gets the auth
    // code at all. Read from app.json's experiments.baseUrl (the single
    // source of truth for this path) rather than hardcoding it here. Only
    // applied on web — native already redirects correctly via its own
    // `scheme` (see app.json) and isn't affected by baseUrl.
    //
    // Deliberately NOT trying to force a trailing slash here (an earlier
    // version of this comment did) — expo-web-browser's web createURL()
    // strips any trailing slash unconditionally, so this always resolves to
    // the no-slash form regardless. That's fine: GitHub Pages' own
    // redirect-to-add-a-slash only matters if something re-derives the
    // redirect URI from the browser's address bar *after* that redirect
    // happens, which is exactly the mistake the token exchange no longer
    // makes (see consumeWebRedirectAuthResult's originalRedirectUri below).
    Platform.OS === 'web' && Constants.expoConfig?.experiments?.baseUrl
      ? { path: Constants.expoConfig.experiments.baseUrl.replace(/^\/|\/$/g, '') }
      : undefined,
  );

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
// Web sign-in: full-page redirect, not a popup
// ---------------------------------------------------------------------------
// expo-auth-session's default web flow opens Google's sign-in in a popup and
// waits for it to either postMessage back (success) or close (fallback,
// detected by polling `.closed`). Both of those depend on the popup keeping
// a working `window.opener` link back to this page. Once the popup visits
// accounts.google.com, Chrome's Cross-Origin-Opener-Policy on Google's own
// page can permanently sever that link — even after the popup navigates
// back to our own origin. When that happens the postMessage never arrives,
// and the only thing the opener can still observe is "the popup closed"
// (response.type 'dismiss'), with no way to recover the actual result —
// confirmed happening on this project's real OAuth client, not theoretical.
//
// A full-page redirect sidesteps the whole problem: there's no second
// window, so nothing depends on window.opener. startWebRedirectAuth begins
// it; consumeWebRedirectAuthResult (called once on mount) picks it back up
// after Google sends the user back here. Native is unaffected — it never
// used this popup path to begin with.
const WEB_REDIRECT_VERIFIER_KEY = 'roost.google.pendingCodeVerifier';
const WEB_REDIRECT_STATE_KEY = 'roost.google.pendingState';
const WEB_REDIRECT_URI_KEY = 'roost.google.pendingRedirectUri';

export function startWebRedirectAuth(request: AuthRequest): void {
  if (!request.url) throw new Error('Google sign-in is still loading — wait a moment and try again.');
  if (request.codeVerifier) window.localStorage.setItem(WEB_REDIRECT_VERIFIER_KEY, request.codeVerifier);
  window.localStorage.setItem(WEB_REDIRECT_STATE_KEY, request.state);
  // Stashed purely as a debugging aid — consumeWebRedirectAuthResult hands
  // this back so the caller can compare it against whatever it reconstructs
  // for the token exchange, in case those two ever diverge.
  window.localStorage.setItem(WEB_REDIRECT_URI_KEY, request.redirectUri);
  window.location.href = request.url;
}

/** Call once on mount. If the current URL is Google sending the user back
 * (a `code`/`state` or `error` query param), consumes it — clearing both the
 * URL and the stashed verifier/state so a page refresh doesn't replay it —
 * and returns the result. Returns null if there's nothing to consume. */
export function consumeWebRedirectAuthResult():
  | { type: 'success'; code: string; codeVerifier: string; originalRedirectUri: string | null }
  | { type: 'error'; message: string }
  | null {
  if (Platform.OS !== 'web') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const state = params.get('state');
  if (!code && !error) return null;

  const originalRedirectUri = window.localStorage.getItem(WEB_REDIRECT_URI_KEY);
  const cleanUp = () => {
    window.localStorage.removeItem(WEB_REDIRECT_VERIFIER_KEY);
    window.localStorage.removeItem(WEB_REDIRECT_STATE_KEY);
    window.localStorage.removeItem(WEB_REDIRECT_URI_KEY);
    window.history.replaceState(null, '', window.location.pathname);
  };
  const expectedState = window.localStorage.getItem(WEB_REDIRECT_STATE_KEY);

  if (error) {
    cleanUp();
    return { type: 'error', message: params.get('error_description') ?? error };
  }
  if (!expectedState || state !== expectedState) {
    cleanUp();
    return {
      type: 'error',
      message: 'This sign-in response didn’t match the request that started it — please try Connect again.',
    };
  }
  if (!code) {
    cleanUp();
    return { type: 'error', message: 'Sign-in response was missing its authorization code — please try Connect again.' };
  }
  const codeVerifier = window.localStorage.getItem(WEB_REDIRECT_VERIFIER_KEY);
  cleanUp();
  if (!codeVerifier) {
    return { type: 'error', message: 'Missing this sign-in’s verifier — please try Connect again.' };
  }
  return { type: 'success', code, codeVerifier, originalRedirectUri };
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

/** Returns a usable access token for one connected account's Calendar API
 * calls, refreshing (and persisting the result) if the stored one is
 * missing or within 60s of expiry. Throws if that account isn't found or
 * was never actually connected. */
export async function getFreshGoogleAccessToken(accountId: string): Promise<string> {
  const { googleAccounts, updateGoogleAccount } = useSettingsStore.getState();
  const account = googleAccounts.find((a) => a.id === accountId);
  if (!account) throw new Error('That Google account is no longer connected.');
  if (account.accessToken && account.expiresAt && account.expiresAt - Date.now() > 60_000) {
    return account.accessToken;
  }
  if (!account.refreshToken) {
    throw new Error('Google Calendar is not connected — sign in from Settings first.');
  }
  const t = await refreshGoogleAccessToken(account.refreshToken);
  updateGoogleAccount(accountId, {
    accessToken: t.accessToken,
    expiresAt: t.expiresAt,
    ...(t.refreshToken ? { refreshToken: t.refreshToken } : {}),
  });
  return t.accessToken;
}

/** The connected account's own email — fetched right after token exchange
 * so multiple Google accounts can be told apart in the UI (and so a
 * reconnect can be matched to the right existing row instead of appending a
 * duplicate). Uses the `email`/`openid` scopes already requested above. */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not read the Google account's email: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { email?: string };
  return json.email ?? '';
}

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
};

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

/** `google:<accountId>:<calId>` → which account and which of its calendars.
 * Anything else (including the pre-multi-account legacy `'google'` /
 * `google:<calId>` forms — see runCalendarIdBackfillIfPending in
 * useAppStore.ts, which rewrites any live row to the current form) → null. */
export function googleCalIdFor(calendarId?: string | null): { accountId: string; calId: string } | null {
  if (!calendarId || !calendarId.startsWith('google:')) return null;
  const rest = calendarId.slice('google:'.length);
  const sep = rest.indexOf(':');
  if (sep === -1) return null;
  const accountId = rest.slice(0, sep);
  const calId = rest.slice(sep + 1) || 'primary';
  return accountId ? { accountId, calId } : null;
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

function mapGoogleEvent(e: GoogleEvent, accountId: string, calId: string): CalendarEvent {
  const dateTime = e.start?.dateTime ?? e.start?.date ?? new Date().toISOString();
  const d = new Date(dateTime);
  return {
    id: `google_${accountId}_${calId}_${e.id}`,
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
    calendarId: `google:${accountId}:${calId}`,
  };
}

/** Pulls upcoming events from every given calendar (id list, e.g. from
 * fetchGoogleCalendarList) of one account. Each event is tagged with its
 * `google:<accountId>:<calId>`. */
export async function fetchGoogleEvents(
  accessToken: string,
  accountId: string,
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
      return (json.items ?? []).map((e) => mapGoogleEvent(e, accountId, calId));
    }),
  );
  const all = perCalendar.flat();
  // eslint-disable-next-line no-console
  console.log(`[google] fetched ${all.length} event(s) across ${calendarIds.length} calendar(s)`);
  return all;
}

/** Full sync for one connected account — refreshes its calendar list, pulls
 * events from every calendar in it, and swaps them into the app's calendar.
 * Shared by Settings' "Sync Now"/Connect and the Calendar screen's "Sync
 * All", and records per-account status (spinner/last-synced/error) in
 * useProviderSyncStatusStore so both UIs reflect it without extra plumbing.
 * Returns how many events were fetched; throws (after recording the error)
 * on failure so Sync All's Promise.allSettled can tell this account apart
 * from ones that succeeded. */
export async function syncGoogleAccount(accountId: string): Promise<number> {
  useProviderSyncStatusStore.getState().setStatus('google', accountId, { state: 'syncing' });
  try {
    const accessToken = await getFreshGoogleAccessToken(accountId);
    const calendars = await fetchGoogleCalendarList(accessToken);
    useSettingsStore.getState().updateGoogleAccount(accountId, { calendars });
    const ids = calendars.length ? calendars.map((c) => c.id) : ['primary'];
    const events = await fetchGoogleEvents(accessToken, accountId, ids);
    useCalendarStore.getState().replaceSyncedEvents('google', accountId, events, ids);
    useProviderSyncStatusStore.getState().setStatus('google', accountId, { state: 'ok', at: new Date().toISOString() });
    return events.length;
  } catch (err: any) {
    useProviderSyncStatusStore
      .getState()
      .setStatus('google', accountId, { state: 'error', message: String(err?.message ?? err), at: new Date().toISOString() });
    throw err;
  }
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

/** True when events can currently be written to that account (connected, a
 * refresh token on hand, and its toggle in Settings left on). */
function googleWritable(accountId: string): boolean {
  const account = useSettingsStore.getState().googleAccounts.find((a) => a.id === accountId);
  return !!account && account.enabled && !!account.refreshToken;
}

/** Mirrors a newly-created event to the Google calendar named by `calendarId`
 * (`google:<accountId>:<calId>`); returns its Google id, or null if that
 * account isn't connected/enabled or `calendarId` isn't a Google one. */
export async function mirrorNewEventToGoogle(
  event: CalendarEvent,
  calendarId: string | null | undefined,
): Promise<string | null> {
  const parsed = googleCalIdFor(calendarId);
  if (!parsed || !googleWritable(parsed.accountId)) return null;
  return createGoogleEvent(await getFreshGoogleAccessToken(parsed.accountId), parsed.calId, event);
}

/** Pushes an edit to the event's mirrored Google copy on its own calendar
 * (no-op if it has no googleId / isn't a Google event / that account is
 * off). */
export async function pushEventEditToGoogle(event: CalendarEvent): Promise<void> {
  const parsed = googleCalIdFor(event.calendarId);
  if (!event.googleId || !parsed || !googleWritable(parsed.accountId)) return;
  await patchGoogleEvent(await getFreshGoogleAccessToken(parsed.accountId), parsed.calId, event.googleId, event);
}

/** Deletes the event's mirrored Google copy from `calendarId` (no-op if that
 * account is off). */
export async function deleteEventFromGoogle(
  calendarId: string | null | undefined,
  googleId: string,
): Promise<void> {
  const parsed = googleCalIdFor(calendarId);
  if (!parsed || !googleWritable(parsed.accountId)) return;
  await deleteGoogleEvent(await getFreshGoogleAccessToken(parsed.accountId), parsed.calId, googleId);
}

/** Moves an already-mirrored event from one Google calendar to another —
 * only within the same account; Google's `move` endpoint has no notion of
 * moving an event to a different account. */
export async function moveEventBetweenGoogleCalendars(
  fromCalendarId: string | null | undefined,
  toCalendarId: string | null | undefined,
  googleId: string,
): Promise<boolean> {
  const from = googleCalIdFor(fromCalendarId);
  const to = googleCalIdFor(toCalendarId);
  if (!from || !to || from.accountId !== to.accountId || from.calId === to.calId || !googleWritable(from.accountId)) {
    return false;
  }
  await moveGoogleEvent(await getFreshGoogleAccessToken(from.accountId), from.calId, to.calId, googleId);
  return true;
}