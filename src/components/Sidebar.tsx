// The left nav rail for the wide/desktop layout — replaces TopBar's old
// inline tab row + settings gear on that layout only (see TopBar.tsx's wide
// branch and App.tsx, which mounts this conditionally). Narrow/mobile layout
// is untouched for now; this is the desktop half of the Material-leaning
// redesign — mobile gets its own pass later.
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from '../navigation/types';
import { BoardsIcon, CalendarIcon, ChoresIcon, HomeIcon, MealIcon, PlusIcon, QuestionIcon, SettingsIcon } from './icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const SIDEBAR_WIDTH = 92;

const NAV_ITEMS: { route: keyof RootStackParamList; label: string; Icon: typeof HomeIcon }[] = [
  { route: 'Home', label: 'Home', Icon: HomeIcon },
  { route: 'Calendar', label: 'Calendar', Icon: CalendarIcon },
  { route: 'Chores', label: 'Chores', Icon: ChoresIcon },
  { route: 'MealPlans', label: 'Meals', Icon: MealIcon },
  { route: 'Boards', label: 'Boards', Icon: BoardsIcon },
];

// What the "+" quick-add button offers — one hop to each section rather than
// trying to remotely trigger that screen's own add modal from here, which
// would mean lifting that state out of every screen. Each screen already has
// its own prominent Add button once you land there.
const ADD_TARGETS: { route: keyof RootStackParamList; label: string }[] = [
  { route: 'Calendar', label: 'Add Event' },
  { route: 'Chores', label: 'Add Chore' },
  { route: 'MealPlans', label: 'Add Meal' },
  { route: 'Boards', label: 'Add To-Do' },
];

export function Sidebar({ activeRouteName }: { activeRouteName: string | undefined }) {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <View style={[styles.rail, { backgroundColor: theme.colors.panel, borderRightColor: theme.colors.border }]}>
      <Pressable onPress={() => navigation.navigate('Home')} hitSlop={6}>
        <Image source={require('../../assets/icons/huddle-logo.png')} style={styles.brandMark} resizeMode="contain" />
      </Pressable>

      <View>
        <Pressable
          onPress={() => setAddOpen((v) => !v)}
          style={[styles.addBtn, { backgroundColor: theme.colors.accent }]}
        >
          <PlusIcon size={20} color="#fff" />
        </Pressable>
        {addOpen && (
          <>
            {/* Tapping anywhere outside the menu closes it — a full-screen
                layer behind the menu itself, same dismiss pattern used for
                the screensaver/preview elsewhere in the app. */}
            <Pressable style={styles.addMenuScrim} onPress={() => setAddOpen(false)} />
            <View style={[styles.addMenu, { backgroundColor: theme.colors.panel, borderColor: theme.colors.border }]}>
              {ADD_TARGETS.map((t) => (
                <Pressable
                  key={t.route}
                  onPress={() => {
                    setAddOpen(false);
                    navigation.navigate(t.route as any);
                  }}
                  style={styles.addMenuItem}
                >
                  <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: theme.colors.ink }}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map(({ route: r, label, Icon }) => {
          const active = activeRouteName === r;
          return (
            <Pressable
              key={r}
              onPress={() => navigation.navigate(r as any)}
              style={[styles.navItem, active && { backgroundColor: theme.colors.accentBg }]}
            >
              <Icon size={20} color={active ? theme.colors.accent : theme.colors.inkSoft} />
              <Text
                numberOfLines={1}
                style={[
                  styles.navLabel,
                  { fontFamily: theme.fonts.bodyBold, color: active ? theme.colors.accent : theme.colors.inkSoft },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => navigation.navigate('Help')} style={styles.settingsBtn} hitSlop={6}>
        <QuestionIcon size={20} color={activeRouteName === 'Help' ? theme.colors.accent : theme.colors.inkSoft} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn} hitSlop={6}>
        <SettingsIcon size={20} color={activeRouteName === 'Settings' ? theme.colors.accent : theme.colors.inkSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: SIDEBAR_WIDTH,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 20,
    borderRightWidth: 1,
  },
  brandMark: { width: 34, height: 26 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addMenuScrim: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
  },
  addMenu: {
    position: 'absolute',
    left: 54,
    top: 0,
    width: 160,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addMenuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  navList: { flex: 1, alignItems: 'center', gap: 6, width: '100%' },
  navItem: {
    width: 72,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    gap: 3,
  },
  navLabel: { fontSize: 10.5 },
  settingsBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
