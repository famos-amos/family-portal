// A plain-language guide to what each screen does and how to get around —
// opened from the "?" button in Sidebar.tsx (desktop) right above Settings.
// Static content, no store reads beyond theme — nothing here needs to be
// kept in sync with live data.
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import {
  BoardsIcon,
  CalendarIcon,
  CameraIcon,
  ChoresIcon,
  DevicesIcon,
  HomeIcon,
  MealIcon,
  MicIcon,
  QrCodeIcon,
  SettingsIcon,
} from '../components/icons';

type Topic = { Icon: React.ComponentType<{ size?: number; color?: string }>; tint: string; iconColor: string; title: string; body: string };

export function HelpScreen() {
  const theme = useTheme();

  const topics: Topic[] = [
    {
      Icon: HomeIcon,
      tint: theme.colors.calBg,
      iconColor: theme.colors.calDk,
      title: 'Home',
      body: 'Your dashboard — a snapshot of the calendar, today’s events, the to-do list, meal plan, verse of the day, daily challenge, and everyone’s chores, all on one screen. Tap any card to jump to its full screen; drag the small corner handle on a card to see more or less detail.',
    },
    {
      Icon: CalendarIcon,
      tint: theme.colors.calBg,
      iconColor: theme.colors.calDk,
      title: 'Calendar',
      body: 'Switch between Day, Week, and Month views at the top. Tap the + to add an event, or tap any existing event to edit it. Connect a Google or Apple calendar, or subscribe to any public calendar link, from Settings → Connected Calendars.',
    },
    {
      Icon: ChoresIcon,
      tint: theme.colors.choresBg,
      iconColor: '#3E8A52',
      title: 'Chores',
      body: 'Assign chores to family members, set how many points each is worth, and check them off as they’re done. Each person’s progress ring and star count update automatically.',
    },
    {
      Icon: MealIcon,
      tint: theme.colors.mealBg,
      iconColor: theme.colors.mealDk,
      title: 'Meal Plans',
      body: 'Plan breakfast, lunch, and dinner for each day of the week. The Recipes tab holds a reusable recipe box, and Meal Ideas is a running list of suggestions anyone in the family can add to and later assign to a day.',
    },
    {
      Icon: BoardsIcon,
      tint: theme.colors.boardsBg,
      iconColor: theme.colors.boardsDk,
      title: 'Boards',
      body: 'Three shared lists: Family To-Do, Wishlist, and Shopping List. Add an item, assign it to someone, and check it off when it’s done — some lists can auto-clear finished items after a while, set per item.',
    },
    {
      Icon: MicIcon,
      tint: theme.colors.accentBg,
      iconColor: theme.colors.accent,
      title: 'Talk',
      body: 'The microphone button, top-right of every screen. Tap it, say what you need — "add milk to the shopping list" or "mark dishes done for Alex" — then tap Done (it also stops on its own after 30 seconds). Review what it understood before anything is actually added.',
    },
    {
      Icon: CameraIcon,
      tint: theme.colors.accentBg,
      iconColor: theme.colors.accent,
      title: 'Snap',
      body: 'The camera button, next to Talk. Snap a photo of a flyer, invitation, or school notice, and it’s read automatically — proposing a calendar event, reminder, or shopping item for you to confirm.',
    },
    {
      Icon: QrCodeIcon,
      tint: theme.colors.calBg,
      iconColor: theme.colors.calDk,
      title: 'QR Code',
      body: 'Next to Talk and Snap. Tap it to show a scannable code for this exact page — point a phone’s camera at it to open the same Huddle there.',
    },
    {
      Icon: SettingsIcon,
      tint: theme.colors.boardsBg,
      iconColor: theme.colors.boardsDk,
      title: 'Settings',
      body: 'Family member names, colors and birthdays; appearance (light/dark, color theme, zoom); connected calendars; the screensaver; notifications; the app PIN lock; and your family account.',
    },
    {
      Icon: DevicesIcon,
      tint: theme.colors.verseBg,
      iconColor: '#7B5FA0',
      title: 'Getting around',
      body: 'On a tablet or desktop, the icons down the left side are Home, Calendar, Chores, Meals, and Boards — the orange + opens a quick-add menu. On a phone, those same sections are along the bottom instead, and you can also swipe left or right to move between them.',
    },
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Help & Navigation</Text>
        <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
          A quick tour of what each part of Huddle does and how to find it.
        </Text>

        {topics.map((t) => (
          <View key={t.title} style={[styles.card, { backgroundColor: theme.colors.panel, borderColor: theme.colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: t.tint }]}>
              <t.Icon size={20} color={t.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15.5, color: theme.colors.ink, marginBottom: 5 }}>
                {t.title}
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.inkSoft, lineHeight: 20 }}>
                {t.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 720 },
  h1: { fontSize: 22, marginBottom: 6 },
  sub: { fontSize: 13.5, lineHeight: 20, marginBottom: 22 },
  card: {
    flexDirection: 'row',
    gap: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 14,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
