import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { ColorScheme, darkColors, lightColors } from './colors';
import { fonts, radii, spacing } from './typography';
import { useSettingsStore } from '../store/useAppStore';
import { sectionColorsFor } from '../lib/paletteColors';

type Theme = {
  colors: ColorScheme;
  fonts: typeof fonts;
  radii: typeof radii;
  spacing: typeof spacing;
  isDark: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themePreference = useSettingsStore((s) => s.theme);
  const paletteId = useSettingsStore((s) => s.paletteId);
  const customPaletteSeed = useSettingsStore((s) => s.customPaletteSeed);
  const systemScheme = useColorScheme();

  const isDark =
    themePreference === 'dark' ||
    (themePreference === 'system' && systemScheme === 'dark');

  const value = useMemo<Theme>(() => {
    const base = isDark ? darkColors : lightColors;
    // 'classic' keeps colors.ts's hand-tuned values exactly, so the default
    // look never regresses — only a non-classic palette overrides the
    // section colors (cal/meal/chores/boards/verse/accent), leaving the
    // neutrals (bg/panel/ink/border/etc.) alone either way.
    const sectionOverrides = sectionColorsFor(paletteId, customPaletteSeed, isDark);
    const colors: ColorScheme = sectionOverrides ? { ...base, ...sectionOverrides } : base;
    return { colors, fonts, radii, spacing, isDark };
  }, [isDark, paletteId, customPaletteSeed]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() must be used within a ThemeProvider');
  return ctx;
}
