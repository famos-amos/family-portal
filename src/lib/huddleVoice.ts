// Sends one recorded Huddle clip to the huddle-voice Edge Function (which
// holds the Gemini API key — see that function's header comment) and gets
// back a transcript + structured actions.
//
// Deliberately reads the recording via plain `fetch(uri).blob()` rather than
// expo-file-system's File class: that class's web implementation is a bare
// stub (`class FileSystemFile { constructor() { console.warn(...) } }`,
// no other methods at all), so touching almost anything on a `File` instance
// on web throws (e.g. "this.validatePath is not a function"). `fetch` on a
// local URI → `.blob()` is standard web/Fetch API and works the same on web
// (blob: URLs) and native (file:// URIs, via RN's fetch polyfill) — the same
// pattern already used successfully in ambientPhotos.ts's photo upload.
import { VoiceAction } from './huddleActions';
import { buildHuddleContext } from './huddleContext';

export type HuddleAnalysis = { transcript: string; actions: VoiceAction[] };

function functionsBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_HUDDLE_VOICE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/functions/v1/huddle-voice`;
  throw new Error(
    'Huddle needs a backend to understand voice clips. Set EXPO_PUBLIC_SUPABASE_URL (or ' +
      'EXPO_PUBLIC_HUDDLE_VOICE_URL) so the huddle-voice Edge Function is used.',
  );
}

/** Uploads the recorded clip at `fileUri` and returns Gemini's transcript +
 * extracted actions. Throws with a readable message on any failure. */
export async function analyzeHuddleRecording(fileUri: string): Promise<HuddleAnalysis> {
  let blob: Blob;
  try {
    blob = await (await fetch(fileUri)).blob();
  } catch (err) {
    throw new Error(`Could not read the recording — ${String(err)}`);
  }
  // expo-audio's recorder doesn't reliably set the Blob's own .type on every
  // platform, so fall back to the m4a/AAC container RecordingPresets.HIGH_QUALITY
  // actually produces rather than a generic/empty mime type.
  const mimeType = blob.type || 'audio/mp4';
  const context = buildHuddleContext();
  const url = `${functionsBaseUrl()}?context=${encodeURIComponent(JSON.stringify(context))}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
  } catch (err) {
    throw new Error(`Could not reach the Huddle voice backend — ${String(err)}`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Huddle voice backend error: ${res.status}`);
  }
  if (!Array.isArray(data.actions)) {
    throw new Error("Huddle's response didn't include any actions — try recording again.");
  }
  return { transcript: data.transcript ?? '', actions: data.actions as VoiceAction[] };
}

// Re-exported so callers that only need to apply/build reviewable actions
// don't have to know this module exists.
export { buildReviewableActions, applyVoiceAction } from './huddleActions';
export type { ReviewableAction } from './huddleActions';
