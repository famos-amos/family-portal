import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useSettingsStore } from '../store/useAppStore';
import { RootStackParamList } from '../navigation/types';
import { NARROW_BREAKPOINT } from '../lib/layout';
import { SettingsIcon } from './icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** "Monday · October 12, 2026" — re-read once a minute so a wall-mounted
 * tablet left open overnight picks up the date rolling over at midnight
 * without needing a refresh. */
function useTodayLabel(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${weekday} · ${monthDay}, ${now.getFullYear()}`;
}

// Navigation itself lives elsewhere now on both layouts — Sidebar.tsx (wide)
// or BottomTabBar.tsx (narrow) — so this header is just the page title/date
// on the left, a theme toggle, and (narrow only) a Settings gear. Wide
// drops the gear because Sidebar has its own pinned Settings icon;
// BottomTabBar deliberately doesn't (mirrors Sidebar's own split between
// its main nav list and that separate pinned icon), so narrow keeps it here.
export function TopBar() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_BREAKPOINT;
  const todayLabel = useTodayLabel();
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.bg }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: narrow ? 20 : 24, color: theme.colors.ink }}>
          Huddle
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: narrow ? 12.5 : 13.5,
            color: theme.colors.inkSoft,
            marginTop: 2,
          }}
        >
          {todayLabel}
        </Text>
      </View>
      {/* On narrow, HuddleControls (Talk/Snap/QR) floats absolutely over
          this header anchored to the right edge, sized to leave room for
          exactly one 38px icon button here — so narrow stays at just the
          Settings gear rather than also adding a theme toggle here. */}
      {narrow ? (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={[
            styles.iconBtn,
            route.name === 'Settings'
              ? { backgroundColor: theme.colors.ink }
              : { backgroundColor: theme.isDark ? '#FFFFFF14' : '#00000008' },
          ]}
        >
          <SettingsIcon size={20} color={route.name === 'Settings' ? theme.colors.panel : theme.colors.inkSoft} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setTheme(theme.isDark ? 'light' : 'dark')}
          style={[styles.iconBtn, { backgroundColor: theme.isDark ? '#FFFFFF14' : '#00000008' }]}
          accessibilityLabel={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Text style={{ fontSize: 17 }}>{theme.isDark ? '🌙' : '☀️'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
