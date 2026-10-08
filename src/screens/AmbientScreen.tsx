// The ambient screensaver — shown full-screen, on top of the whole app, once
// nobody has touched the screen for `ambient.idleMinutes` (see App.tsx /
// useIdleTimer). Touching anywhere dismisses it (the touch bubbles up to
// App.tsx's root view, which resets the idle timer — nothing to wire here).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useSettingsStore } from '../store/useAppStore';
import { ambientCategoryById } from '../data/ambientBackgrounds';
import { listAmbientPhotos } from '../lib/ambientPhotos';
import { fetchCurrentWeather, weatherEmoji, type CurrentWeather } from '../lib/weather';

const FADE_MS = 1800;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function AmbientScreen() {
  const ambient = useSettingsStore((s) => s.ambient);
  const [photos, setPhotos] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<CurrentWeather | null>(null);

  // Load the photo pool whenever the source/category changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list: string[] = [];
      if (ambient.source === 'photos') {
        list = (await listAmbientPhotos()).map((p) => p.url);
      } else {
        list = ambientCategoryById(ambient.curatedCategoryId)?.photos ?? [];
      }
      if (cancelled) return;
      const ordered = ambient.transitionStyle === 'random' ? shuffle(list) : list;
      setPhotos(ordered);
      setIndex(0);
      setCurrentUrl(ordered[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient.source, ambient.curatedCategoryId, ambient.transitionStyle]);

  // Advance to the next photo on a timer, cross-fading between the two.
  useEffect(() => {
    if (photos.length <= 1) return;
    const ms = Math.max(1, ambient.transitionMinutes) * 60 * 1000;
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % photos.length;
        setNextUrl(photos[next]);
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start(() => {
          setCurrentUrl(photos[next]);
          fade.setValue(0);
          setNextUrl(null);
        });
        return next;
      });
    }, ms);
    return () => clearInterval(id);
  }, [photos, ambient.transitionMinutes, fade]);

  // Clock — only needs to tick once a minute for display purposes.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  // Weather — fetch on mount/location change, then refresh periodically.
  useEffect(() => {
    if (!ambient.showWeather || !ambient.weatherLocation) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchCurrentWeather(ambient.weatherLocation!).then((w) => {
        if (!cancelled) setWeather(w);
      });
    };
    load();
    const id = setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ambient.showWeather, ambient.weatherLocation]);

  const timeLabel = useMemo(
    () => now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    [now],
  );
  const dateLabel = useMemo(
    () => now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    [now],
  );

  return (
    <View style={styles.fill} pointerEvents="box-only">
      <View style={[styles.fill, { backgroundColor: '#15110c' }]}>
        {currentUrl && <Image source={{ uri: currentUrl }} style={styles.fill} resizeMode="cover" />}
        {nextUrl && (
          <Animated.Image source={{ uri: nextUrl }} style={[styles.fill, { opacity: fade }]} resizeMode="cover" />
        )}
      </View>

      {/* A gentle gradient-like scrim at the bottom so clock/weather text
          stays legible over a bright photo, without darkening the whole image. */}
      <View style={styles.scrim} />

      {(ambient.showClock || (ambient.showWeather && weather)) && (
        <View style={styles.overlayText}>
          {ambient.showClock && (
            <>
              <Text style={styles.time}>{timeLabel}</Text>
              <Text style={styles.date}>{dateLabel}</Text>
            </>
          )}
          {ambient.showWeather && weather && (
            <Text style={styles.weather}>
              {weatherEmoji(weather.code, weather.isDay)} {weather.temperatureF}°
              {ambient.weatherLocation ? `  ·  ${ambient.weatherLocation.label}` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Dims the whole screen when Settings → brightness is turned down —
          on native this is on top of expo-brightness actually lowering the
          backlight; on web it's the only dimming mechanism there is. */}
      {ambient.brightness < 1 && (
        <View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: '#000', opacity: 1 - ambient.brightness }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
    backgroundColor: '#000',
    opacity: 0.32,
  },
  overlayText: { position: 'absolute', left: 40, bottom: 36 },
  time: { fontSize: 72, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  date: { fontSize: 20, color: '#fff', opacity: 0.85, marginTop: 4 },
  weather: { fontSize: 22, color: '#fff', opacity: 0.9, marginTop: 10 },
});
