// Minimal, dependency-free RSS parsing — good enough for pulling the first
// <item>'s <title>/<description> out of a typical RSS 2.0 feed (which is
// all Verse of the Day / Daily Challenge feeds need). This mirrors the same
// hand-rolled-regex approach already used for CalDAV XML in
// src/lib/appleCalendar.ts rather than pulling in a full XML parser
// dependency just for this.
export type RssItem = { title: string; description: string; pubDate?: string };

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

/** Fetches `url` and returns its first <item> as {title, description,
 * pubDate}, or null if the feed can't be reached or parsed — a network
 * error, a CORS block (common when this runs in a web browser against a
 * feed whose server doesn't send CORS headers — see README's note on
 * this), or an unexpected/empty format. Never throws; callers are expected
 * to fall back to local content on null. */
export async function fetchFirstRssItem(url: string): Promise<RssItem | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();
    const itemMatch = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/i);
    if (!itemMatch) return null;
    const block = itemMatch[1];
    const title = extractTag(block, 'title') ?? '';
    const description = extractTag(block, 'description') ?? '';
    const pubDate = extractTag(block, 'pubDate');
    if (!title && !description) return null;
    return { title, description, pubDate };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[rss] fetch/parse of ${url} failed —`, err);
    return null;
  }
}