// Verse of the Day, sourced from a real RSS feed (OurManna's, by default —
// a well-known, no-signup daily Bible verse feed) instead of the app's own
// small built-in rotation. See useVerseStore in src/store/useAppStore.ts for
// how this is cached/retried, and VerseWidgetContent in
// src/screens/home/widgets.tsx for the local fallback shown while a fetch is
// in flight or if one fails.
//
// IMPORTANT (web only): most RSS feeds, OurManna included, aren't guaranteed
// to send CORS headers, so a browser can block this fetch's response body
// even though the request itself succeeds — this shows up as a console
// error, not a crash, and the app just falls back to its local verse list
// for that load. This does not affect the native Android tablet build,
// where there is no browser CORS restriction on the request. See README.md
// → "Verse of the Day (RSS feed)".
import { fetchFirstRssItem } from './rss';

export const OURMANNA_FEED_URL = 'https://www.ourmanna.com/verses/rss/votd.xml';

export type VerseOfDay = { text: string; reference: string };

const looksLikeReference = (s: string) => /^[1-3]?\s*[A-Za-z. ]+\d+(:\d+(-\d+)?)?$/.test(s.trim());

/** OurManna's feed puts the reference in <title> (e.g. "Psalm 23:1") and the
 * verse text in <description>. Some other verse-of-the-day feeds instead put
 * everything into one field as "Verse text - Reference" — this handles both
 * shapes so it degrades gracefully if OurManna ever changes format, or if
 * you swap in a different feed URL later. Returns null (never throws) if
 * the feed can't be reached/parsed or doesn't look like a verse at all. */
export async function fetchVerseOfDay(feedUrl: string = OURMANNA_FEED_URL): Promise<VerseOfDay | null> {
  const item = await fetchFirstRssItem(feedUrl);
  if (!item) return null;

  if (item.title && looksLikeReference(item.title) && item.description) {
    return { text: item.description, reference: item.title };
  }

  // Fallback shape: "verse text - Reference" all in one field (whichever of
  // title/description actually has content) — split on the LAST " - " so a
  // verse whose own text happens to contain a hyphen doesn't get cut
  // mid-sentence.
  const combined = item.description || item.title;
  const dashIdx = combined.lastIndexOf(' - ');
  if (dashIdx > 0) {
    return { text: combined.slice(0, dashIdx).trim(), reference: combined.slice(dashIdx + 3).trim() };
  }

  // Couldn't confidently separate text from reference — show it as-is with
  // no reference rather than guessing wrong.
  return combined ? { text: combined, reference: '' } : null;
}