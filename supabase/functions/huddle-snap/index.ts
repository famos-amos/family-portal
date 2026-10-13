// @ts-nocheck — runs on Supabase's Deno runtime, not in the Expo app's
// TypeScript project (which excludes `supabase/`).
//
// Supabase Edge Function: huddle-snap
// -----------------------------------------------------------------------------
// Takes one photo (the "Snap" button — a flyer, school notice, invitation,
// event poster, etc.) and asks Google Gemini to (a) summarize what it read
// and (b) extract a list of structured actions — add a calendar event, set a
// reminder, add a shopping-list item, or update the week's meal plan — using
// the exact same action shape huddle-voice uses, since Gemini can take an
// image directly as input.
//
//   POST /functions/v1/huddle-snap?context=<URL-encoded JSON>
//     body: the raw photo bytes (Content-Type: its real mime type)
//     → { summary: string, actions: VoiceAction[] }
//
// `context` carries just enough live household data for Gemini to quote
// EXACT existing names back (so the client can match actions to real
// records) instead of guessing — see huddleContext.ts in the app, which
// builds the identical shape for both this function and huddle-voice.
//
// Needs the same Gemini API key as huddle-voice, already set as a secret:
//   supabase secrets set GEMINI_API_KEY=<your key>
//   supabase functions deploy huddle-snap --no-verify-jwt
//
// `--no-verify-jwt` for the same reason as the other functions in this repo
// (google-oauth, ics-proxy, huddle-voice) — no per-user Supabase session
// exists here.
// -----------------------------------------------------------------------------
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same model choice + retry strategy as huddle-voice — see that function's
// header comment for why gemini-pro-latest is deliberately NOT the fallback
// here (confirmed live: it resolves to gemini-3.1-pro, which has a hard 0
// free-tier quota on this account — not an overload, a permanent block
// without billing enabled). gemini-3.8-flash is Google's own current
// recommended replacement for the flash models they've been retiring, and
// tested as reachable, so it's the same-tier fallback instead.
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

// 3 attempts per model (900ms then 1800ms backoff) rather than 2 — a single
// quick retry wasn't outlasting a sustained busy spell in practice.
const BACKOFF_MS = [900, 1800];

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
        continue;
      }
      break;
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
  return `You are the assistant for "Huddle", a shared family wall-calendar app. You were just handed one photo —
taken with a "Snap" button — of something like a flyer, school notice, invitation, event poster, permission slip,
or similar. Look at the photo and:

1. Briefly summarize what it is and the key details you read (one or two sentences).
2. Extract zero or more concrete actions a family should take based on it. A single flyer can contain several
   (e.g. an event to add to the calendar AND a permission slip due date reminder AND an ingredient to buy).

Today is ${ctx.todayIso} (a ${ctx.dayOfWeek}). Resolve relative or partial dates against that — if a flyer gives
only a day-of-week or "this Friday", resolve it to the next real occurrence of that date. Family members:
${ctx.familyNames.join(", ") || "(none recorded)"}. Open (not-yet-done) chores right now: ${
    ctx.openChoreTitles.join(", ") || "(none)"
  }. This week's planned dinners so far: ${
    ctx.plannedMeals.map((m) => `${m.day} ${m.slot}: ${m.name}`).join("; ") || "(none yet)"
  }.

Return ONLY JSON (no markdown fences, no commentary) matching exactly this shape:

{
  "summary": "<what this photo is and the key details, 1-2 sentences>",
  "actions": [
    // zero or more of the following, in whatever order makes sense:
    { "type": "calendar_event", "title": "...", "date": "YYYY-MM-DD", "time": "3:30 PM" | null, "endTime": "4:30 PM" | null },
    { "type": "reminder", "title": "...", "date": "YYYY-MM-DD" | null, "time": "3:30 PM" | null },
    { "type": "shopping_item", "title": "..." },
    // day is one of mon/tue/wed/thu/fri/sat/sun; slot is breakfast/lunch/dinner
    { "type": "meal_plan", "day": "mon", "slot": "dinner", "name": "..." }
  ]
}

If the photo doesn't clearly show anything actionable (not a flyer/notice, too blurry, unrelated), return an empty
"actions" array and say so plainly in "summary" — don't invent details that aren't actually legible in the photo.
Never return a "chore_complete" action here — Snap is for adding new things, not marking existing chores done.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // See huddle-voice's identical wrapper for why — an uncaught exception in
  // here used to come back as a bare, non-JSON "Internal Server Error".
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

    const mimeType = req.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const imageBytes = new Uint8Array(await req.arrayBuffer());
    if (imageBytes.length === 0) {
      return json({ error: "No image data in request body." }, 400);
    }
    const imageBase64 = encodeBase64(imageBytes);

    let data: any;
    try {
      data = await callGeminiWithRetry(apiKey, [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: buildPrompt(ctx) },
      ]);
    } catch (err) {
      return json({ error: String((err as Error)?.message ?? err) }, 502);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return json({ error: "Gemini returned no content (the photo may have been unreadable)." }, 502);
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
    console.error("[huddle-snap] unhandled error", err);
    return json({ error: `Unexpected error: ${String((err as Error)?.message ?? err)}` }, 500);
  }
});
