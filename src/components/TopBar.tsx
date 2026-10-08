import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from '../navigation/types';
import { NARROW_BREAKPOINT } from '../lib/layout';
import { SettingsIcon } from './icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Illustrated badges cropped from the brand artwork — one per tab, including
// the "H" mark standing in for Home (the wordmark itself lives in the brand
// row instead, see `brand` below).
const TABS: { route: keyof RootStackParamList; label: string; image: number; accent: string }[] = [
  { route: 'Home', label: 'Home', image: require('../../assets/icons/huddle-logo.png'), accent: '#4A3B2E' },
  { route: 'Calendar', label: 'Calendar', image: require('../../assets/icons/calendar.png'), accent: '#2E6E82' },
  { route: 'Chores', label: 'Chores', image: require('../../assets/icons/chores.png'), accent: '#2E7A4D' },
  { route: 'MealPlans', label: 'Meal Plans', image: require('../../assets/icons/meals.png'), accent: '#9C6A1E' },
  { route: 'Boards', label: 'Boards', image: require('../../assets/icons/todo.png'), accent: '#A24D6E' },
];

export function TopBar() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_BREAKPOINT;

  const renderTab = ({ route: r, label, image, accent }: (typeof TABS)[number]) => {
    const active = route.name === r;
    const iconSize = narrow ? 22 : 28;
    return (
      <Pressable
        key={r}
        onPress={() => navigation.navigate(r as any)}
        style={[
          styles.tab,
          !narrow && styles.tabWide,
          // Each tab keeps its own accent color even when inactive — a soft
          // tint of it for the pill background, rather than flattening every
          // inactive tab to the same grey — so the row reads as colorful at
          // a glance, not just the one active tab.
          active
            ? { backgroundColor: theme.colors.panel, borderColor: accent }
            : { backgroundColor: accent + (theme.isDark ? '26' : '16') },
        ]}
      >
        <View style={[{ width: iconSize, height: iconSize }, !active && { opacity: 0.8 }]}>
          <Image source={image} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
        </View>
        <Text
          style={[
            styles.tabLabel,
            !narrow && styles.tabLabelWide,
            { fontFamily: theme.fonts.headSemiBold, color: active ? theme.colors.ink : theme.colors.inkSoft },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const brand = (
    <View style={styles.brand}>
      <Image
        source={require('../../assets/icons/huddle-wordmark.png')}
        style={[styles.brandWordmark, { tintColor: theme.colors.ink }]}
        resizeMode="contain"
        accessibilityLabel="Huddle"
      />
    </View>
  );

  const settingsBtn = (
    <Pressable
      onPress={() => navigation.navigate('Settings')}
      style={[
        styles.settingsBtn,
        route.name === 'Settings'
          ? { backgroundColor: theme.colors.ink }
          : { backgroundColor: theme.isDark ? '#FFFFFF14' : '#00000008' },
      ]}
    >
      <SettingsIcon size={20} color={route.name === 'Settings' ? theme.colors.panel : theme.colors.inkSoft} />
    </Pressable>
  );

  // Phone / narrow window: brand + 5 tab pills + settings can't share one
  // row, so the tab row wraps into a vertical stack. Split it into
  // two rows instead — identity on top, tabs on their own row, scrolling
  // horizontally so they stay a single strip.
  if (narrow) {
    return (
      <View style={[styles.bar, styles.barNarrow, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.narrowTopRow}>
          {brand}
          <View style={{ flex: 1 }} />
          {settingsBtn}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {TABS.map(renderTab)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.bg }]}>
      {brand}
      <View style={styles.tabs}>{TABS.map(renderTab)}</View>
      {settingsBtn}
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
  barNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  narrowTopRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  brandWordmark: { width: 85, height: 27 },
  // Centered (not left-packed against the brand) now that there's room —
  // the wide header has the brand on the left and settings/Talk on the
  // right, with the tabs free to sit in the middle of what's left.
  tabs: { flexDirection: 'row', gap: 10, flex: 1, flexWrap: 'wrap', justifyContent: 'center' },
  tabsScroll: { flexDirection: 'row', gap: 8, paddingRight: 24 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabWide: { paddingHorizontal: 18, paddingVertical: 11, gap: 8 },
  tabLabel: { fontSize: 13 },
  tabLabelWide: { fontSize: 14.5 },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
