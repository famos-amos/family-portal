// @ts-nocheck — this file runs on Supabase's Deno runtime, not in the Expo
// app's TypeScript project (which excludes `supabase/`). `Deno`, `Deno.serve`
// and remote URL imports are all provided there.
// Supabase Edge Function: google-oauth
// -----------------------------------------------------------------------------
// Holds the Google **Web application** OAuth client secret (which must never
// ship in the app bundle) and does the two calls that need it:
//
//   POST { "action": "exchange", "code", "codeVerifier", "redirectUri" }
//       → redeems an authorization code for { access_token, refresh_token,
//         expires_in }. Used once, right after a web sign-in.
//
//   POST { "action": "refresh", "refreshToken" }
//       → trades a stored refresh token for a fresh { access_token,
//         expires_in }. Used by the app whenever its access token is stale,
//         with no user interaction — this is what "offline" 2-way sync needs.
//
// The app calls this at  <SUPABASE_URL>/functions/v1/google-oauth  (see
// src/lib/googleCalendar.ts → tokenProxyUrl). Native builds skip it entirely
// (installed-app clients refresh without a secret); only the web build needs it.
//
// Deploy:
//   supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<web client id> \
//                        GOOGLE_OAUTH_CLIENT_SECRET=<web client secret>
//   supabase functions deploy google-oauth --no-verify-jwt
//
// `--no-verify-jwt` because the app has no per-user Supabase session; this
// function is safe to call unauthenticated since it only ever talks to Google
// with its own credentials and returns Google's own token response.
// -----------------------------------------------------------------------------

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return json(
      { error: "Function is missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET secrets." },
      500,
    );
  }

  let payload: Record<string, string>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });

  if (payload.action === "exchange") {
    if (!payload.code || !payload.redirectUri) {
      return json({ error: "exchange needs `code` and `redirectUri`." }, 400);
    }
    form.set("grant_type", "authorization_code");
    form.set("code", payload.code);
    form.set("redirect_uri", payload.redirectUri);
    if (payload.codeVerifier) form.set("code_verifier", payload.codeVerifier);
  } else if (payload.action === "refresh") {
    if (!payload.refreshToken) return json({ error: "refresh needs `refreshToken`." }, 400);
    form.set("grant_type", "refresh_token");
    form.set("refresh_token", payload.refreshToken);
  } else {
    return json({ error: 'action must be "exchange" or "refresh".' }, 400);
  }

  const googleRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await googleRes.json().catch(() => ({}));

  if (!googleRes.ok) {
    // Surface Google's own error code AND description (e.g.
    // "invalid_grant: Bad Request", "redirect_uri_mismatch: ..."). The code
    // alone (invalid_grant, invalid_client, redirect_uri_mismatch, …) is what
    // actually says what's wrong — dropping it and keeping only the
    // description left every failure looking like a bare "Bad Request".
    const code = data.error ?? "error";
    const detail = data.error_description ? `: ${data.error_description}` : "";
    // eslint-disable-next-line no-console
    console.error(`[google-oauth] ${payload.action} -> ${googleRes.status} ${code}${detail}`, data);
    return json({ error: `${code}${detail}` }, googleRes.status);
  }

  // Pass through exactly what Google returned: access_token, expires_in,
  // scope, token_type, and (on first consent / with prompt=consent) refresh_token.
  return json(data);
});
