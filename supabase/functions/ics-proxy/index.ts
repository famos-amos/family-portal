// @ts-nocheck — runs on Supabase's Deno runtime, not in the Expo app's
// TypeScript project (which excludes `supabase/`).
//
// Supabase Edge Function: ics-proxy
// -----------------------------------------------------------------------------
// Fetches a public calendar's ICS/webcal feed server-side and returns its
// text, with permissive CORS headers, so the web build can read calendars
// that (like almost all ICS feeds) send no `Access-Control-Allow-Origin`
// header of their own. Native builds can fetch ICS directly and skip this.
//
//   GET  /functions/v1/ics-proxy?url=<url-encoded ICS or webcal URL>
//        → 200 text/calendar  (the raw .ics body)
//
// Only http/https/webcal URLs are allowed, and the response is capped so this
// can't be turned into an open relay for arbitrary large downloads.
//
// Deploy:
//   supabase functions deploy ics-proxy --no-verify-jwt
// -----------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Use GET." }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) {
    return new Response(JSON.stringify({ error: "Missing ?url=" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // webcal:// is just https:// with a different scheme label.
  const normalised = raw.replace(/^webcal:\/\//i, "https://");
  let target: URL;
  try {
    target = new URL(normalised);
  } catch {
    return new Response(JSON.stringify({ error: "Not a valid URL." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new Response(JSON.stringify({ error: "Only http(s)/webcal URLs are allowed." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { Accept: "text/calendar, text/plain, */*" },
      redirect: "follow",
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Could not reach the calendar: ${String(err)}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Calendar responded ${upstream.status} ${upstream.statusText}` }),
      { status: upstream.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const body = await upstream.text();
  if (body.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "Calendar feed is too large." }), {
      status: 413,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(body, {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "text/calendar; charset=utf-8" },
  });
});
