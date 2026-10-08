// Picks a readable text/icon color for a solid background color, based on
// that color's own brightness — not the app's light/dark theme setting.
//
// Several accent tokens (calDk, mealDk, boardsDk, and `ink` itself — see
// theme/colors.ts) are deliberately a dark, saturated shade in light mode
// but flip to a pale, light shade in dark mode (so they stay legible as
// plain text/icon color against the page background in both themes). That's
// correct for text sitting ON the page background — but a few places use
// those same tokens as a solid BUTTON/CHIP background with hardcoded white
// foreground content, which only has contrast in light mode: in dark mode
// the background turns pale and the white text/icon on top of it nearly
// disappears. contrastText() fixes that by choosing white or dark text
// based on whichever shade the background actually resolved to.
export function contrastText(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#FFFFFF';
  // Perceived brightness (ITU-R BT.601 quick formula), 0-255.
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 165 ? '#2A2118' : '#FFFFFF';
}
