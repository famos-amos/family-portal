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
// the time this shipped and would have failed every request). Verified
// against the account's actual /v1beta/models list before picking this.
const GEMINI_MODEL = "gemini-flash-latest";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
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

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: audioBase64 } },
              { text: buildPrompt(ctx) },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  const data = await geminiRes.json().catch(() => ({}));

  if (!geminiRes.ok) {
    return json({ error: data?.error?.message ?? "Gemini request failed." }, geminiRes.status);
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
});
