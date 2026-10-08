// In-app brightness control — there's no physical brightness button on a
// wall-mounted tablet, so Settings → Screensaver exposes a slider instead.
//
// On native (Android/iOS), expo-brightness can dim the screen while THIS
// app is in the foreground, no special permission needed for app-level
// (as opposed to system-wide) brightness. On web there's no way for a page
// to dim the actual backlight, so applyBrightness() there is a no-op —
// App.tsx instead layers a semi-transparent black View over everything,
// which is the practical equivalent in a browser.
import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

/** 0–1. Sets this app's own screen brightness on native; no-op on web (see
 * the dimming overlay in App.tsx instead). Never throws. */
export async function applyNativeBrightness(value: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Brightness.setBrightnessAsync(Math.max(0.05, Math.min(1, value)));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[brightness] setBrightnessAsync failed —', err);
  }
}

/** Restores whatever the device's brightness was before the app touched it
 * (native only). Called when the brightness feature is turned off. */
export async function restoreSystemBrightness(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Brightness.restoreSystemBrightnessAsync();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[brightness] useSystemBrightnessAsync failed —', err);
  }
}
