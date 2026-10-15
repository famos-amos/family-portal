// The narrow/mobile layout's primary nav — mirrors Sidebar.tsx's desktop
// rail (same 5 routes, same vector icons, same accent-colored active state)
// but as a fixed bottom bar, the standard mobile nav placement, instead of a
// horizontally-scrolling row of illustrated badges at the top. Settings
// stays in TopBar's narrow header (a single gear, like the wide layout) —
// this bar is just the 5 main sections, same split as Sidebar's main nav
// list vs. its separate pinned Settings icon.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from '../navigation/types';
import { BoardsIcon, CalendarIcon, ChoresIcon, HomeIcon, MealIcon } from './icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NAV_ITEMS: { route: keyof RootStackParamList; label: string; Icon: typeof HomeIcon }[] = [
  { route: 'Home', label: 'Home', Icon: HomeIcon },
  { route: 'Calendar', label: 'Calendar', Icon: CalendarIcon },
  { route: 'Chores', label: 'Chores', Icon: ChoresIcon },
  { route: 'MealPlans', label: 'Meals', Icon: MealIcon },
  { route: 'Boards', label: 'Boards', Icon: BoardsIcon },
];

export function BottomTabBar({ activeRouteName }: { activeRouteName: string | undefined }) {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.panel,
          borderTopColor: theme.colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {NAV_ITEMS.map(({ route: r, label, Icon }) => {
        const active = activeRouteName === r;
        return (
          <Pressable key={r} onPress={() => navigation.navigate(r as any)} style={styles.item}>
            <View style={[styles.iconWrap, active && { backgroundColor: theme.colors.accentBg }]}>
              <Icon size={20} color={active ? theme.colors.accent : theme.colors.inkSoft} />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { fontFamily: theme.fonts.bodyBold, color: active ? theme.colors.accent : theme.colors.inkSoft },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 14 },
  label: { fontSize: 10.5 },
});
