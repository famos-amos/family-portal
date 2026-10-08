// Sends one photo (the "Snap" button — a flyer, notice, invitation, etc.) to
// the huddle-snap Edge Function and gets back a short summary of what it read
// + structured actions, using the exact same VoiceAction shape and review
// flow as the Huddle voice button (see huddleActions.ts).
//
// Reads the photo via plain `fetch(uri).blob()` rather than expo-file-system
// — see huddleVoice.ts's header comment for why (that class's web build is a
// non-functional stub).
import { VoiceAction } from './huddleActions';
import { buildHuddleContext } from './huddleContext';

export type SnapAnalysis = { summary: string; actions: VoiceAction[] };

function functionsBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/functions/v1/huddle-snap`;
  throw new Error(
    'Huddle needs a backend to read flyer photos. Set EXPO_PUBLIC_SUPABASE_URL so the huddle-snap Edge Function is used.',
  );
}

/** Uploads the photo at `imageUri` and returns Gemini's summary of what it
 * read + extracted actions. Throws with a readable message on any failure. */
export async function analyzeFlyerPhoto(imageUri: string): Promise<SnapAnalysis> {
  let blob: Blob;
  try {
    blob = await (await fetch(imageUri)).blob();
  } catch (err) {
    throw new Error(`Could not read the photo — ${String(err)}`);
  }
  const mimeType = blob.type || 'image/jpeg';
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
    throw new Error(`Could not reach the Huddle snap backend — ${String(err)}`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Huddle snap backend error: ${res.status}`);
  }
  if (!Array.isArray(data.actions)) {
    throw new Error("Huddle's response didn't include any actions — try another photo.");
  }
  return { summary: data.summary ?? '', actions: data.actions as VoiceAction[] };
}

// Re-exported so callers that only need to apply/build reviewable actions
// don't have to know this module exists.
export { buildReviewableActions, applyVoiceAction } from './huddleActions';
export type { ReviewableAction } from './huddleActions';
