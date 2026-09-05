// Verse of the Day — sourced from OurManna's public JSON API
// (https://beta.ourmanna.com/api/v1/get), NOT their RSS feed.
//
// Why the switch: the RSS feed (ourmanna.com/verses/rss/votd.xml) doesn't
// send an Access-Control-Allow-Origin header, so a web browser blocks it
// outright — that's the "TypeError: Failed to fetch" / CORS console error
// from before. The JSON API is a different, purpose-built endpoint that
// OurManna designed specifically for "call this from your own website's
// JavaScript" (their docs' own live API tester, hosted on a different
// domain than the API itself, fetches it successfully from the browser —
// that only works at all because the API sends permissive CORS headers).
// So a direct `fetch()` to it works from web the same as it always has
// from native, with no proxy or workaround needed. See README.md → "Verse
// of the Day (RSS feed)".
//
// Response shape (format=json):
//   {"verse":{"details":{"text":"...","reference":"...","version":"NIV","verseurl":"..."},"notice":"Powered by OurManna.com"}}

export type VerseOfDay = { text: string; reference: string };

export const OURMANNA_API_URL = 'https://beta.ourmanna.com/api/v1/get?format=json&order=daily';

/** Fetches today's verse from OurManna's JSON API. Returns null (never
 * throws) on any failure — offline, the API being down/rate-limited, or an
 * unexpected/empty response shape — so callers always have a safe local
 * fallback verse to show instead. */
export async function fetchVerseOfDay(apiUrl: string = OURMANNA_API_URL): Promise<VerseOfDay | null> {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const details = data?.verse?.details;
    const text: string | undefined = details?.text;
    const reference: string | undefined = details?.reference;
    if (!text) return null;
    return { text, reference: reference ?? '' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[verse] fetch of ${apiUrl} failed —`, err);
    return null;
  }
}