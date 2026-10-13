// Warm & Playful design tokens, ported from the design mockups.
// Light values are the source of truth from the mockup; dark values are a
// first pass and worth a design review once real dark screenshots exist.

export type ColorScheme = {
  bg: string;
  panel: string;
  ink: string;
  inkSoft: string;
  border: string;
  fieldBg: string;

  cal: string;
  calBg: string;
  calDk: string;
  chores: string;
  choresBg: string;
  meal: string;
  mealBg: string;
  mealDk: string;
  boards: string;
  boardsBg: string;
  boardsDk: string;
  verse: string;
  verseBg: string;
  // The full-width "Chores this week" bar at the bottom of the dashboard —
  // a warm neutral tan here in Classic, deliberately NOT the same green as
  // the per-person chore rings elsewhere (that's `chores`/`choresBg`, still
  // used there). A non-Classic theme palette (see paletteColors.ts) DOES
  // tie this to that palette's chosen "Chores" color, just at a different
  // shade than choresBg — it's the only chores-colored surface the home
  // dashboard actually shows, so leaving it untouched made picking a new
  // Chores color look like it did nothing.
  choresWeekBg: string;

  // The one app-wide "primary" color — the sidebar's logo/add button and
  // the active nav item, per the Material-leaning redesign (see
  // Sidebar.tsx). Deliberately separate from cal/meal/chores/boards/verse,
  // which stay each section's own color — this is chrome, not content.
  accent: string;
  accentBg: string;

  success: string;
  danger: string;
  star: string;
};

export const lightColors: ColorScheme = {
  bg: '#FBF4E9',
  panel: '#FFFFFF',
  ink: '#4A3B2E',
  inkSoft: '#8B7B6A',
  border: '#00000018',
  fieldBg: '#F7F2E8',

  cal: '#AFD8E8',
  calBg: '#EAF6FA',
  calDk: '#3E7A90',
  chores: '#BEE3C8',
  choresBg: '#EEF9EF',
  meal: '#F6D9A8',
  mealBg: '#FDF3E2',
  mealDk: '#9C6A1E',
  boards: '#F3C6D6',
  boardsBg: '#FCEDF2',
  boardsDk: '#A24D6E',
  verse: '#D9C7EC',
  verseBg: '#F5EFFB',
  choresWeekBg: '#F3E6D3',

  accent: '#C8673E',
  accentBg: '#FBE4D7',

  success: '#3E8A62',
  danger: '#C0524B',
  star: '#F2B33D',
};

// First-pass dark palette — same hues, inverted surfaces. Flag for design
// review once this ships to a real device (see design-spec.md "Next steps").
export const darkColors: ColorScheme = {
  bg: '#241E17',
  panel: '#2F281F',
  ink: '#F3E9DB',
  inkSoft: '#B7A791',
  border: '#FFFFFF1E',
  fieldBg: '#3A3226',

  cal: '#6FA9C2',
  calBg: '#28353B',
  calDk: '#9AD3EA',
  chores: '#7FB98E',
  choresBg: '#25332A',
  meal: '#D1A45F',
  mealBg: '#382C1E',
  mealDk: '#E8C583',
  boards: '#CE8DA6',
  boardsBg: '#372630',
  boardsDk: '#E9A9C4',
  verse: '#A98BC9',
  verseBg: '#2E2836',
  choresWeekBg: '#3A3226',

  accent: '#E8956B',
  accentBg: '#3A2A20',

  success: '#5CB37F',
  danger: '#D9756D',
  star: '#F2B33D',
};

// Per-person colors are user-assignable (see Settings), these are just the
// defaults offered when a family member is created.
export const personColorOptions = [
  '#D98CA6', // rose
  '#7FA8D9', // blue
  '#5FB8A8', // teal
  '#E3A94C', // amber
  '#B79FD6', // purple
  '#8FC48F', // green
  '#E88A7D', // coral
  '#7D9BC4', // slate blue
] as const;
