// Global "zoom" for Settings → Appearance → Size. Rather than threading a
// scale factor through every font/card size in the app, this wraps the
// whole screen in a View sized to (100/scale)% and visually scaled back up
// to 100% via a transform — a full-page-zoom trick, not a font-size
// multiplier, so it scales literally everything (fonts, card padding, icons,
// gaps) in one place with no per-component changes. The outer View centers
// the inner one, so the inner box's own transform-origin (its center,
// RN/RNWeb's default) lands exactly on the outer box's center — scaling it
// back up to `scale` then makes it land flush with the outer box's edges on
// every side, with no manual transformOrigin needed.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSettingsStore } from '../store/useAppStore';

export function UiScaleWrapper({ children }: { children: React.ReactNode }) {
  const scale = useSettingsStore((s) => s.uiScale);

  if (scale === 1) return <>{children}</>;

  const inversePercent = `${100 / scale}%` as const;

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { width: inversePercent, height: inversePercent, transform: [{ scale }] }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  inner: {},
});
