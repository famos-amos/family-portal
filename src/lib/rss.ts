// Minimal, dependency-free RSS parsing — good enough for pulling the first
// <item>'s <title>/<description> out of a typical RSS 2.0 feed (which is
// all Verse of the Day / Daily Challenge feeds need). This mirrors the same
// hand-rolled-regex approach already used for CalDAV XML in
// src/lib/appleCalendar.ts rather than pulling in a full XML parser
// dependency just for this.
import { Platform } from 'react-native';

export type RssItem = { title: string; description: string; pubDate?: string };

// Most RSS feeds (OurManna included) don't send an `Access-Control-Allow-
// Origin` header, so a direct `fetch()` from a web browser — both `expo
// start --web` on localhost and the deployed GitHub Pages build — gets
// blocked by the browser's CORS policy before the response body is even
// readable (this shows up as "TypeError: Failed to fetch" / a CORS error in
// the console, not as a normal HTTP error). Native builds (the Android
// tablet) aren't subject to browser CORS at all, so they're unaffected.
//
// allorigins.win is a small, free, no-signup passthrough proxy that fetches
// the URL server-side and re-serves it with a permissive CORS header — it's
// third-party infrastructure Roost doesn't control, so treat it as another
// way this can fail, not a guarantee: if it's ever down or rate-limited,
// fetchFirstRssItem still returns null like any other failure and callers
// fall back to local content exactly as before. Only used on web, and only
// as a fallback after a direct fetch fails, so native never depends on it
// and a feed that does happen to send CORS headers is never routed through
// a third party unnecessarily.
function corsProxyUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripCdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : s;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return undefined;
  return decodeEntities(stripHtml(stripCdata(m[1].trim())));
}

function parseFeedXml(xml: string): RssItem | null {
  const itemMatch = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/i);
  if (!itemMatch) return null;
  const block = itemMatch[1];
  const title = extractTag(block, 'title') ?? '';
  const description = extractTag(block, 'description') ?? '';
  const pubDate = extractTag(block, 'pubDate');
  if (!title && !description) return null;
  return { title, description, pubDate };
}

/** Fetches `url` and returns its first <item> as {title, description,
 * pubDate}, or null if the feed can't be reached or parsed — a network
 * error, a CORS block (see the note above — retried once through a CORS
 * proxy on web before giving up), or an unexpected/empty format. Never
 * throws; callers are expected to fall back to local content on null. */
export async function fetchFirstRssItem(url: string): Promise<RssItem | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseFeedXml(await res.text());
  } catch (err) {
    if (Platform.OS !== 'web') {
      // eslint-disable-next-line no-console
      console.error(`[rss] fetch/parse of ${url} failed —`, err);
      return null;
    }
    // On web, a thrown fetch error (rather than a normal non-ok response) is
    // almost always the browser blocking the response for lack of a CORS
    // header — retry once through the proxy before giving up.
    // eslint-disable-next-line no-console
    console.warn(`[rss] direct fetch of ${url} failed on web (likely CORS) — retrying via proxy —`, err);
    try {
      const res = await fetch(corsProxyUrl(url));
      if (!res.ok) return null;
      return parseFeedXml(await res.text());
    } catch (proxyErr) {
      // eslint-disable-next-line no-console
      console.error(`[rss] proxy fetch of ${url} also failed —`, proxyErr);
      return null;
    }
  }
}