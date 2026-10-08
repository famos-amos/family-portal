// Current weather for the ambient screensaver's optional overlay. Uses
// Open-Meteo (https://open-meteo.com) — free, no API key, no account, and no
// rate-limit surprises for a single wall-mounted tablet's occasional polling.
//
// Since this is a fixed wall display (it doesn't travel with the family),
// the location is set once in Settings rather than requested from the OS —
// that avoids a location-permission flow entirely for a device whose
// location never actually changes.
import type { WeatherLocation } from '../store/types';
export type { WeatherLocation };

export type CurrentWeather = {
  temperatureF: number;
  /** Open-Meteo's WMO weather code — see weatherEmoji() below for what each means. */
  code: number;
  isDay: boolean;
};

// A representative subset of WMO weather codes (https://open-meteo.com/en/docs
// → "WMO Weather interpretation codes"), mapped to a single emoji each. Falls
// back to a generic cloud for anything not explicitly listed.
const CODE_EMOJI: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌧️',
  57: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '❄️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  85: '🌨️',
  86: '❄️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
};

export function weatherEmoji(code: number, isDay: boolean): string {
  if (code === 0 || code === 1) return isDay ? '☀️' : '🌙';
  return CODE_EMOJI[code] ?? '☁️';
}

/** Fetches current conditions for `location`. Returns null (never throws) on
 * any failure, so the screensaver just omits the weather line rather than
 * erroring. */
export async function fetchCurrentWeather(location: WeatherLocation): Promise<CurrentWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}` +
      `&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const current = json?.current;
    if (!current || typeof current.temperature_2m !== 'number') return null;
    return {
      temperatureF: Math.round(current.temperature_2m),
      code: current.weather_code ?? 0,
      isDay: current.is_day === 1,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[weather] fetch failed —', err);
    return null;
  }
}

/** Turns a place name into { lat, lon } using Open-Meteo's own free geocoding
 * endpoint — lets Settings offer a plain text search box instead of asking
 * for raw coordinates. */
export async function geocodeLocation(query: string): Promise<WeatherLocation[]> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const results: any[] = json?.results ?? [];
    return results.map((r) => ({
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[weather] geocode failed —', err);
    return [];
  }
}
