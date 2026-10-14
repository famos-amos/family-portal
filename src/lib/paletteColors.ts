// Derives a full set of section colors (calendar/meals/chores/boards/verse/
// accent — each needs a "main" card tone, a pale "Bg" tint, and sometimes a
// saturated "Dk" tone for text/icons on a light surface) from a single seed
// hex per section, for the Settings → Appearance theme picker. The "Classic"
// palette bypasses this entirely and uses the app's original hand-tuned
// colors.ts values untouched, so the default look never regresses — this
// file only generates the 4 alternate presets plus whatever the user picks
// for "Custom".
import { ColorScheme, lightColors } from '../theme/colors';
import { PaletteId, PaletteSeed } from '../store/types';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Clamp to a [floor, cap] saturation band rather than just a cap — a cap
// alone let a low-saturation input (e.g. a grayish or already-pale swatch)
// produce a "bg" tint so close to white it was indistinguishable from the
// plain page background, which was most of why picking a new color didn't
// look like it did anything.
function clampSaturation(s: number, floor: number, cap: number): number {
  return Math.max(Math.min(s, cap), floor);
}

/** One seed hex → the 4 shades a section actually needs: "main" (the card
 * header-bar tint — see SectionTitle in widgets.tsx — and icon color), a
 * "bg" tint (reserved for places that still want a pale wash), a saturated
 * "dk" (text/icons that need contrast on a light card), and "weekBg" (the
 * full-width Chores bar's tone — same hue, pulled slightly darker/more
 * saturated than "bg"). Tuned by eye against the existing hand-picked
 * palette rather than any formal contrast target.
 *
 * `bold` (used by the Bold Brights/Jewel Tones presets) shifts "main"
 * noticeably more saturated and a bit darker/richer — those two presets
 * exist specifically to look bolder than Classic/Ocean/Sunset/Forest/Berry,
 * so they get their own stronger constants rather than just a more
 * saturated seed hex (which the normal saturation cap would otherwise
 * flatten back down to the same boldness as every other preset). */
export function deriveSectionShades(
  seedHex: string,
  isDark: boolean,
  bold = false,
): { main: string; bg: string; dk: string; weekBg: string } {
  const [r, g, b] = hexToRgb(seedHex);
  const [h, s] = rgbToHsl(r, g, b);
  if (!isDark) {
    return {
      main: bold
        ? rgbToHex(...hslToRgb(h, clampSaturation(s, 0.55, 0.85), 0.6))
        : rgbToHex(...hslToRgb(h, clampSaturation(s, 0.35, 0.6), 0.76)),
      bg: rgbToHex(...hslToRgb(h, clampSaturation(s, 0.3, 0.55), 0.91)),
      dk: bold
        ? rgbToHex(...hslToRgb(h, clampSaturation(s, 0.55, 0.85), 0.3))
        : rgbToHex(...hslToRgb(h, clampSaturation(s, 0.4, 0.6), 0.36)),
      weekBg: rgbToHex(...hslToRgb(h, clampSaturation(s, 0.28, 0.5), 0.85)),
    };
  }
  return {
    main: bold
      ? rgbToHex(...hslToRgb(h, clampSaturation(s, 0.5, 0.8), 0.48))
      : rgbToHex(...hslToRgb(h, clampSaturation(s, 0.3, 0.45), 0.42)),
    bg: rgbToHex(...hslToRgb(h, clampSaturation(s, 0.25, 0.4), 0.2)),
    dk: bold
      ? rgbToHex(...hslToRgb(h, clampSaturation(s, 0.5, 0.8), 0.78))
      : rgbToHex(...hslToRgb(h, clampSaturation(s, 0.35, 0.4), 0.74)),
    weekBg: rgbToHex(...hslToRgb(h, clampSaturation(s, 0.25, 0.38), 0.24)),
  };
}

// Classic's seed hexes are only used for the picker's preview dots and as
// the starting point when someone switches to Custom — the palette itself,
// when actually applied (see sectionColorsFor), uses colors.ts's literal
// hand-tuned values instead of anything derived from these.
export const CLASSIC_SEED: PaletteSeed = {
  cal: '#3E7A90',
  meal: '#9C6A1E',
  chores: '#3E8A52',
  boards: '#A24D6E',
  verse: '#7B5FA0',
  accent: '#C8673E',
};

export const PALETTE_PRESETS: { id: Exclude<PaletteId, 'custom'>; label: string; seed: PaletteSeed; bold?: boolean }[] = [
  { id: 'classic', label: 'Classic', seed: CLASSIC_SEED },
  {
    id: 'ocean',
    label: 'Ocean',
    seed: { cal: '#2E7DB8', meal: '#2E9C8F', chores: '#3E8A62', boards: '#4A6FA5', verse: '#5C7FC4', accent: '#2E8FB8' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    seed: { cal: '#D9713C', meal: '#E0984A', chores: '#C75C3E', boards: '#B8456B', verse: '#D4546E', accent: '#E07A3E' },
  },
  {
    id: 'forest',
    label: 'Forest',
    seed: { cal: '#4C8B5A', meal: '#8A9C3E', chores: '#3E8A52', boards: '#6B8E4E', verse: '#5A9C6E', accent: '#5C9C4A' },
  },
  {
    id: 'berry',
    label: 'Berry',
    seed: { cal: '#8A4FA0', meal: '#B85C8E', chores: '#6B4FA0', boards: '#A24D6E', verse: '#7B4FB8', accent: '#A24D8E' },
  },
  // The two bold presets below use `bold: true` (see deriveSectionShades)
  // rather than just picking louder seed hexes — the normal saturation cap
  // would otherwise flatten a louder seed back down to the same boldness as
  // every preset above.
  {
    id: 'brights',
    label: 'Bold Brights',
    bold: true,
    seed: { cal: '#0EA5E9', meal: '#F59E0B', chores: '#22C55E', boards: '#EC4899', verse: '#8B5CF6', accent: '#EF4444' },
  },
  {
    id: 'jewel',
    label: 'Jewel Tones',
    bold: true,
    seed: { cal: '#1D4ED8', meal: '#B45309', chores: '#047857', boards: '#9D174D', verse: '#6D28D9', accent: '#B91C1C' },
  },
];

export function seedFor(paletteId: PaletteId, customSeed: PaletteSeed): PaletteSeed {
  if (paletteId === 'custom') return customSeed;
  return PALETTE_PRESETS.find((p) => p.id === paletteId)?.seed ?? CLASSIC_SEED;
}

function isBoldPalette(paletteId: PaletteId): boolean {
  return PALETTE_PRESETS.find((p) => p.id === paletteId)?.bold ?? false;
}

/** The 6 section colors (as swatch dots, always in light-mode tone so the
 * picker itself doesn't change appearance with the current theme) for one
 * palette — Classic uses the real colors.ts values so its preview matches
 * exactly what's actually applied. */
export function paletteSwatchDots(paletteId: PaletteId, customSeed: PaletteSeed): string[] {
  if (paletteId === 'classic') {
    return [lightColors.cal, lightColors.meal, lightColors.chores, lightColors.boards, lightColors.verse, lightColors.accent];
  }
  const seed = seedFor(paletteId, customSeed);
  const bold = isBoldPalette(paletteId);
  return [seed.cal, seed.meal, seed.chores, seed.boards, seed.verse, seed.accent].map(
    (hex) => deriveSectionShades(hex, false, bold).main,
  );
}

type SectionColors = Pick<
  ColorScheme,
  | 'cal'
  | 'calBg'
  | 'calDk'
  | 'chores'
  | 'choresBg'
  | 'choresWeekBg'
  | 'meal'
  | 'mealBg'
  | 'mealDk'
  | 'boards'
  | 'boardsBg'
  | 'boardsDk'
  | 'verse'
  | 'verseBg'
  | 'accent'
  | 'accentBg'
>;

/** Builds the section colors a non-Classic palette contributes, to be
 * merged over the base light/darkColors neutrals. Returns null for
 * 'classic' — the caller should just use the base colors untouched.
 *
 * `choresWeekBg` (the full-width "Chores this week" bar on the dashboard —
 * the single most visible chores-colored surface in the app) is included
 * here even though it's a separate token from `chores`/`choresBg` in
 * colors.ts — without it, picking a new Chores color had no visible effect
 * on the dashboard at all, since that bar is the only place the dashboard
 * actually shows a chores-tinted background. */
export function sectionColorsFor(paletteId: PaletteId, customSeed: PaletteSeed, isDark: boolean): SectionColors | null {
  if (paletteId === 'classic') return null;
  const seed = seedFor(paletteId, customSeed);
  const bold = isBoldPalette(paletteId);
  const cal = deriveSectionShades(seed.cal, isDark, bold);
  const meal = deriveSectionShades(seed.meal, isDark, bold);
  const chores = deriveSectionShades(seed.chores, isDark, bold);
  const boards = deriveSectionShades(seed.boards, isDark, bold);
  const verse = deriveSectionShades(seed.verse, isDark, bold);
  const accent = deriveSectionShades(seed.accent, isDark, bold);
  return {
    cal: cal.main,
    calBg: cal.bg,
    calDk: cal.dk,
    chores: chores.main,
    choresBg: chores.bg,
    choresWeekBg: chores.weekBg,
    meal: meal.main,
    mealBg: meal.bg,
    mealDk: meal.dk,
    boards: boards.main,
    boardsBg: boards.bg,
    boardsDk: boards.dk,
    verse: verse.main,
    verseBg: verse.bg,
    accent: accent.main,
    accentBg: accent.bg,
  };
}

// A curated, legible set of hues offered as quick-pick swatches for each of
// the 6 Custom palette fields — wide spread around the color wheel so every
// section can be made visually distinct.
export const CUSTOM_SWATCH_OPTIONS = [
  '#D9534F', '#E0984A', '#D9A33E', '#8A9C3E', '#3E8A52', '#2E9C8F',
  '#2E7DB8', '#4A6FA5', '#5C7FC4', '#7B5FA0', '#8A4FA0', '#B85C8E',
  '#A24D6E', '#C8673E', '#6B4F3A',
] as const;
