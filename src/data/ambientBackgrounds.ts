// Curated "artistic background" categories for the ambient screensaver
// (Settings → Screensaver → Curated art). Each category is just a plain list
// of image URLs — nothing here depends on an API key or a live feed.
//
// IMPORTANT — about the starter images: these use picsum.photos (a free,
// keyless placeholder-photo service) with a fixed `seed` per slot so every
// slot is a stable, specific photo rather than truly random noise. They are
// NOT a hand-vetted, theme-accurate photo library — picsum doesn't support
// browsing by subject, so e.g. the "Nature" category is a stable set of
// photos, not guaranteed to all actually be nature scenes. Treat this file
// as a real, working starting point you (or a future pass) should replace
// with actual curated photo URLs per category — just paste direct image
// URLs into the `photos` arrays below, in whatever quantity you like. If you
// want a true live-browsing photo API instead (so categories can grow and
// pull fresh images automatically), say the word — that needs a free
// Unsplash or Pexels developer account and API key, wired in similarly to
// the Google OAuth client ID in app.json.
export type AmbientCategory = {
  id: string;
  label: string;
  /** One-line description shown under the category name in Settings. */
  description: string;
  photos: string[];
};

function picsum(seed: string, w = 1920, h = 1200): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export const AMBIENT_CATEGORIES: AmbientCategory[] = [
  {
    id: 'nature',
    label: 'Nature',
    description: 'Landscapes, light, and the outdoors.',
    photos: Array.from({ length: 8 }, (_, i) => picsum(`huddle-nature-${i}`)),
  },
  {
    id: 'warm',
    label: 'Warm & Cozy',
    description: 'Soft, golden, inviting tones.',
    photos: Array.from({ length: 8 }, (_, i) => picsum(`huddle-warm-${i}`)),
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Quiet, uncluttered, architectural.',
    photos: Array.from({ length: 8 }, (_, i) => picsum(`huddle-minimal-${i}`)),
  },
  {
    id: 'diverse-artists',
    label: 'Diverse Artists',
    description: "A spotlight on work from a wide range of the world's photographers.",
    photos: Array.from({ length: 8 }, (_, i) => picsum(`huddle-diverse-artists-${i}`)),
  },
];

export function ambientCategoryById(id: string | null | undefined): AmbientCategory | undefined {
  return AMBIENT_CATEGORIES.find((c) => c.id === id);
}
