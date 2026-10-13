// @ts-nocheck — runs on Supabase's Deno runtime, not in the Expo app's
// TypeScript project (which excludes `supabase/`).
//
// Supabase Edge Function: huddle-voice
// -----------------------------------------------------------------------------
// Takes one recorded voice clip (the "Huddle button") and asks Google Gemini
// to (a) transcribe it and (b) extract a list of structured actions — add a
// calendar event, set a reminder, mark a chore done, add a shopping-list
// item, or update the week's meal plan — all in one call, since Gemini can
// take audio directly as input.
//
//   POST /functions/v1/huddle-voice?context=<URL-encoded JSON>
//     body: the raw recorded audio (Content-Type: its real mime type)
//     → { transcript: string, actions: VoiceAction[] }
//
// `context` carries just enough live household data for Gemini to quote
// EXACT existing names back (so the client can match actions to real
// records) instead of guessing: today's date, family member names, each
// person's open chore titles, and this week's planned meals. No calendar/
// board data beyond that is sent.
//
// Needs a Gemini API key (Google AI Studio → Get API key — free tier
// available) set as a secret:
//   supabase secrets set GEMINI_API_KEY=<your key>
//   supabase functions deploy huddle-voice --no-verify-jwt
//
// `--no-verify-jwt` for the same reason as the other functions in this repo
// (google-oauth, ics-proxy) — no per-user Supabase session exists here.
// -----------------------------------------------------------------------------
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// "-latest" is Google's self-updating alias for whichever flash model is
// current — deliberately NOT a dated version like "gemini-2.0-flash" (which
// is what this used to say; it was fully removed from Google's lineup by
// the time this shipped and would have failed every request).
//
// IMPORTANT, found by testing directly against this project's real key: do
// NOT fall back to a "pro" model here. gemini-pro-latest currently resolves
// to gemini-3.1-pro, which has a hard 0 free-tier quota on this account
// ("limit: 0" — not throttled, not overloaded, simply inaccessible without
// billing enabled) — falling back to it just replaces a real "overloaded,
// try again" error with a permanent, confusing quota error. gemini-3.8-flash
// is Google's own currently-recommended replacement for the flash models
// they've been retiring (gemini-2.5-flash came back "no longer available to
// new users, use gemini-3.8-flash") and tested as reachable, so it's the
// fallback here instead — same tier as the primary model, not a jump to pro.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.8-flash"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOverloaded(status: number, message: string | undefined): boolean {
  return status === 503 || /overloaded|high demand|unavailable/i.test(message ?? "");
}

// Per-model retry attempts on overload, with increasing backoff (ms) between
// them — 3 attempts rather than 2 because a user reported hitting "the model
// is overloaded" on 100% of tries with no retry at all; one quick retry may
// not outlast a sustained busy spell, so this gives it up to ~4.5s per model
// (900ms + 1800ms backoff) before moving on, which a voice/photo review
// popup can absorb without feeling broken.
const BACKOFF_MS = [900, 1800];

/** Calls Gemini's generateContent, retrying an overloaded model with
 * increasing backoff before moving on to the next model in GEMINI_MODELS.
 * Throws an Error with a user-readable message if every model/attempt
 * fails — if the *last* failure was quota/billing-related rather than
 * overload, that's surfaced as-is rather than masked by an earlier retry's
 * generic message, since it needs a different fix (enable billing) than
 * "just try again" does. */
async function callGeminiWithRetry(apiKey: string, parts: unknown[]): Promise<any> {
  let lastMessage = "Gemini request failed.";
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          },
        );
      } catch (err) {
        // A network-level failure (not an HTTP error response) — this is
        // the case that used to go completely uncaught and surface to the
        // app as a bare "Internal Server Error" with no useful message.
        lastMessage = `Could not reach Gemini (${model}) — ${String((err as Error)?.message ?? err)}`;
        continue;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;

      const message: string | undefined = data?.error?.message;
      lastMessage = message ?? `Gemini request failed (${res.status}).`;
      // eslint-disable-next-line no-console
      console.error(`[huddle] ${model} attempt ${attempt + 1} failed: ${res.status} ${lastMessage}`);

      const overloaded = isOverloaded(res.status, message);
      if (overloaded && attempt < BACKOFF_MS.length) {
        await sleep(BACKOFF_MS[attempt]);
        continue; // retry the same model
      }
      break; // not (further) retryable on this model — try the next one
    }
  }
  throw new Error(lastMessage);
}

type HuddleContext = {
  todayIso: string;
  dayOfWeek: string;
  familyNames: string[];
  openChoreTitles: string[];
  plannedMeals: { day: string; slot: string; name: string }[];
};

function buildPrompt(ctx: HuddleContext): string {
  return `You are the voice assistant for "Huddle", a shared family wall-calendar app. You were just handed one short
voice clip recorded by a family member pressing a "Huddle" button and speaking. Listen to the audio and:

1. Transcribe what was said.
2. Extract zero or more concrete actions the speaker wants taken. A single clip can contain several
   (e.g. planning multiple dinners, or a reminder plus a calendar event).

Today is ${ctx.todayIso} (a ${ctx.dayOfWeek}). Resolve relative dates ("tomorrow", "next Tuesday", "this weekend")
against that. Family members: ${ctx.familyNames.join(", ") || "(none recorded)"}.
Open (not-yet-done) chores right now: ${ctx.openChoreTitles.join(", ") || "(none)"}.
This week's planned dinners so far: ${
    ctx.plannedMeals.map((m) => `${m.day} ${m.slot}: ${m.name}`).join("; ") || "(none yet)"
  }.

Return ONLY JSON (no markdown fences, no commentary) matching exactly this shape:

{
  "transcript": "<what was said, verbatim as best you can tell>",
  "actions": [
    // zero or more of the following, in whatever order they were mentioned:
    { "type": "calendar_event", "title": "...", "date": "YYYY-MM-DD", "time": "3:30 PM" | null, "endTime": "4:30 PM" | null },
    { "type": "reminder", "title": "...", "date": "YYYY-MM-DD" | null, "time": "3:30 PM" | null },
    // choreTitle MUST be copied EXACTLY from the open chores list above if it matches one — never invent a new title for this type
    { "type": "chore_complete", "choreTitle": "..." },
    { "type": "shopping_item", "title": "..." },
    // day is one of mon/tue/wed/thu/fri/sat/sun; slot is breakfast/lunch/dinner
    { "type": "meal_plan", "day": "mon", "slot": "dinner", "name": "..." }
  ]
}

If nothing actionable was said, return an empty "actions" array — don't force an action that wasn't actually
requested. If a chore mentioned doesn't closely match any title in the open-chores list, still return a
"chore_complete" action with your best-guess title (the app will show it as unmatched rather than silently
dropping it).`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // Belt-and-suspenders: anything thrown in here used to propagate past
  // Supabase's own handler and come back as a bare, non-JSON "Internal
  // Server Error" with zero information — confirmed live, not theoretical.
  // Every genuinely expected failure already returns its own json() error
  // below; this only catches the unexpected ones (e.g. a network-level
  // fetch() failure) so the app always gets a readable message instead.
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "Function is missing the GEMINI_API_KEY secret." }, 500);
    }

    const url = new URL(req.url);
    let ctx: HuddleContext;
    try {
      ctx = JSON.parse(url.searchParams.get("context") ?? "{}");
    } catch {
      return json({ error: "`context` query param must be JSON." }, 400);
    }

    const mimeType = req.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mp4";
    const audioBytes = new Uint8Array(await req.arrayBuffer());
    if (audioBytes.length === 0) {
      return json({ error: "No audio data in request body." }, 400);
    }
    const audioBase64 = encodeBase64(audioBytes);

    let data: any;
    try {
      data = await callGeminiWithRetry(apiKey, [
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
        { text: buildPrompt(ctx) },
      ]);
    } catch (err) {
      return json({ error: String((err as Error)?.message ?? err) }, 502);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return json({ error: "Gemini returned no content (the clip may have been silent or unintelligible)." }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "Gemini's response wasn't valid JSON.", raw: text }, 502);
    }

    return json(parsed);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[huddle-voice] unhandled error", err);
    return json({ error: `Unexpected error: ${String((err as Error)?.message ?? err)}` }, 500);
  }
});
