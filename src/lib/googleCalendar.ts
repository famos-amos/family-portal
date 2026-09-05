// Google Calendar 2-way sync.
//
// This talks to the real Google Calendar API (v3) over OAuth 2.0 with PKCE,
// using `expo-auth-session`. It needs a Google Cloud OAuth Client ID that
// only the app owner can create (see README.md "Google Calendar setup").
// Until real client IDs are filled into app.json's `extra` block, `isConfigured()`
// returns false and the Settings screen shows a setup prompt instead of the
// Connect button.
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { CalendarEvent } from '../store/types';

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

function getClientId(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  // AuthSession picks the right client id per-platform; for Expo Go / web we
  // fall back to the web client id since that's the one PKCE flows use there.
  const runningInExpoGo = Constants.appOwnership === 'expo';
  const id = runningInExpoGo
    ? extra.googleOAuthClientIdWeb
    : extra.googleOAuthClientIdAndroid || extra.googleOAuthClientIdIos || extra.googleOAuthClientIdWeb;
  return id;
}

export function isGoogleConfigured(): boolean {
  const id = getClientId();
  return !!id && !id.startsWith('REPLACE_WITH_');
}

export function useGoogleAuthRequest() {
  const clientId = getClientId() ?? '';
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'roost' });

  return AuthSession.useAuthRequest(
    {
      clientId,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    GOOGLE_DISCOVERY,
  );
}

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const clientId = getClientId() ?? '';
  const result = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: { code_verifier: codeVerifier },
    },
    GOOGLE_DISCOVERY,
  );
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  };
}

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
};

/** Pulls events for the next `daysAhead` days from the user's primary Google Calendar. */
export async function fetchGoogleEvents(accessToken: string, daysAhead = 60): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { items?: GoogleEvent[] };

  return (json.items ?? []).map((e) => {
    const dateTime = e.start?.dateTime ?? e.start?.date ?? new Date().toISOString();
    const d = new Date(dateTime);
    return {
      id: `google_${e.id}`,
      date: d.toISOString().slice(0, 10),
      time: e.start?.dateTime
        ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : undefined,
      title: e.summary ?? '(untitled event)',
      personIds: [],
      source: 'google' as const,
    };
  });
}

/** Pushes a locally-created event to Google Calendar. */
export async function pushEventToGoogle(accessToken: string, event: CalendarEvent): Promise<void> {
  const body = event.time
    ? { summary: event.title, start: { dateTime: new Date(`${event.date} ${event.time}`).toISOString() }, end: { dateTime: new Date(`${event.date} ${event.time}`).toISOString() } }
    : { summary: event.title, start: { date: event.date }, end: { date: event.date } };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google Calendar push failed: ${res.status} ${await res.text()}`);
  }
}