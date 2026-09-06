import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useFamilyStore } from '../store/useAppStore';
import { RootStackParamList } from '../navigation/types';
import { NARROW_BREAKPOINT } from '../lib/layout';
import { Avatar } from './Avatar';
import {
  BoardsIcon,
  CalendarIcon,
  ChoresIcon,
  HomeIcon,
  MealIcon,
  SettingsIcon,
} from './icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TABS: { route: keyof RootStackParamList; label: string; Icon: typeof HomeIcon; accent: string }[] = [
  { route: 'Home', label: 'Home', Icon: HomeIcon, accent: '#4A3B2E' },
  { route: 'Calendar', label: 'Calendar', Icon: CalendarIcon, accent: '#2E6E82' },
  { route: 'Chores', label: 'Chores', Icon: ChoresIcon, accent: '#2E7A4D' },
  { route: 'MealPlans', label: 'Meal Plans', Icon: MealIcon, accent: '#9C6A1E' },
  { route: 'Boards', label: 'Boards', Icon: BoardsIcon, accent: '#A24D6E' },
];

export function TopBar() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const members = useFamilyStore((s) => s.members);
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_BREAKPOINT;

  const renderTab = ({ route: r, label, Icon, accent }: (typeof TABS)[number]) => {
    const active = route.name === r;
    return (
      <Pressable
        key={r}
        onPress={() => navigation.navigate(r as any)}
        style={[
          styles.tab,
          active
            ? { backgroundColor: theme.colors.panel, borderColor: accent }
            : { backgroundColor: theme.isDark ? '#FFFFFF10' : '#00000006' },
        ]}
      >
        <Icon size={17} color={active ? accent : theme.colors.inkSoft} />
        <Text
          style={[
            styles.tabLabel,
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
      <View style={styles.brandDot} />
      <Text style={[styles.brandName, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Roost</Text>
    </View>
  );

  const avatars = (
    <View style={styles.avatars}>
      {members.map((m, i) => (
        <Avatar key={m.id} initials={m.initials} color={m.color} size={34} style={{ marginLeft: i === 0 ? 0 : -8 }} />
      ))}
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
      <SettingsIcon size={18} color={route.name === 'Settings' ? theme.colors.panel : theme.colors.inkSoft} />
    </Pressable>
  );

  // Phone / narrow window: brand + 5 tab pills + avatars + settings can't
  // share one row, so the tab row wraps into a vertical stack. Split it into
  // two rows instead — identity/avatars on top, tabs on their own row,
  // scrolling horizontally so they stay a single strip.
  if (narrow) {
    return (
      <View style={[styles.bar, styles.barNarrow, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.narrowTopRow}>
          {brand}
          <View style={{ flex: 1 }} />
          {avatars}
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
      {avatars}
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 6 },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#AFD8E8' },
  brandName: { fontSize: 18 },
  tabs: { flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' },
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
  tabLabel: { fontSize: 13 },
  avatars: { flexDirection: 'row', marginLeft: 4 },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
