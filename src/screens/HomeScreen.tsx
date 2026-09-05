import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useDashboardLayoutStore } from '../store/useAppStore';
import { WidgetId } from '../store/types';
import { WidgetShell } from './home/WidgetShell';
import {
  CalendarWidgetContent,
  ChallengeWidgetContent,
  ChoresWidgetContent,
  EventsWidgetContent,
  MealWidgetContent,
  TodoWidgetContent,
  VerseWidgetContent,
} from './home/widgets';

// Below this width (roughly "phone in portrait" / a narrow browser window)
// the fixed 3-column dashboard grid has no room to breathe, so we fall back
// to a single stacked scrolling column instead. The 10.1" tablet this app
// targets runs at 1920×1200 landscape — comfortably above this threshold —
// so in normal use the grid below is what's shown.
const GRID_BREAKPOINT = 900;

export function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const sizes = useDashboardLayoutStore((s) => s.sizes);
  const setSize = useDashboardLayoutStore((s) => s.setSize);

  const isGrid = width >= GRID_BREAKPOINT;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <Text style={[styles.hint, { color: theme.colors.inkSoft, fontFamily: theme.fonts.bodyBold }]}>
        Tap the corner mark on a card to show more or less detail.
      </Text>
      {isGrid ? (
        <DashboardGrid sizes={sizes} setSize={setSize} theme={theme} />
      ) : (
        <ScrollView style={styles.stackedScroll} contentContainerStyle={styles.stackedContent}>
          {STACKED_ORDER.map((id) => (
            <View key={id} style={styles.stackedItem}>
              <WidgetShell
                backgroundColor={backgroundFor(id, theme)}
                size={SIZED_WIDGETS.has(id) ? sizes[id] : undefined}
                onCycleSize={SIZED_WIDGETS.has(id) ? (next) => setSize(id, next) : undefined}
              >
                {renderWidget(id, sizes[id])}
              </WidgetShell>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// The widgets whose content actually changes at different sizes (see each
// *WidgetContent component) — everything else skips the resize control. To
// Do isn't in this set: instead of resizing to reveal more, it scrolls
// internally within a fixed-size card (see TodoWidgetContent).
const SIZED_WIDGETS = new Set<WidgetId>(['calendar', 'events', 'meal']);
const STACKED_ORDER: WidgetId[] = ['calendar', 'events', 'meal', 'todo', 'challenge', 'verse', 'chores'];

// Reproduces the design's 3-column CSS grid —
//   grid-template-columns: 270px 1fr 300px
//   grid-template-rows: 1fr 1fr 1fr
//   grid-template-areas: "cal events meal" "cal todo challenge" "verse chores chores"
// — with nested flexbox rather than CSS grid so the exact same layout works
// on native (Android tablet) as well as web. The three column widths below
// (270 / 622 / 300) are the mockup's literal pixel widths used as flex
// ratios, so columns line up between the top and bottom row groups.
function DashboardGrid({
  sizes,
  setSize,
  theme,
}: {
  sizes: Record<WidgetId, any>;
  setSize: (id: WidgetId, size: any) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const cell = (id: WidgetId, extraStyle?: object) => (
    <View style={[styles.cell, extraStyle]}>
      <WidgetShell
        backgroundColor={backgroundFor(id, theme)}
        size={SIZED_WIDGETS.has(id) ? sizes[id] : undefined}
        onCycleSize={SIZED_WIDGETS.has(id) ? (next) => setSize(id, next) : undefined}
      >
        {renderWidget(id, sizes[id])}
      </WidgetShell>
    </View>
  );

  return (
    <View style={styles.grid}>
      {/* Rows 1–2: calendar (tall, left) · events/todo (middle) · meal/challenge (right) */}
      <View style={[styles.gridRow, { flex: 2 }]}>
        {cell('calendar', { flex: 270 })}
        <View style={[styles.gridCol, { flex: 622 }]}>
          {cell('events', { flex: 1 })}
          {cell('todo', { flex: 1 })}
        </View>
        <View style={[styles.gridCol, { flex: 300 }]}>
          {cell('meal', { flex: 1 })}
          {cell('challenge', { flex: 1 })}
        </View>
      </View>
      {/* Row 3: verse (left, under calendar) · chores summary (spans the rest) */}
      <View style={[styles.gridRow, { flex: 1 }]}>
        {cell('verse', { flex: 270 })}
        {cell('chores', { flex: 922 })}
      </View>
    </View>
  );
}

function renderWidget(id: WidgetId, size: any) {
  switch (id) {
    case 'calendar':
      return <CalendarWidgetContent size={size} />;
    case 'events':
      return <EventsWidgetContent size={size} />;
    case 'meal':
      return <MealWidgetContent size={size} />;
    case 'todo':
      return <TodoWidgetContent />;
    case 'challenge':
      return <ChallengeWidgetContent />;
    case 'verse':
      return <VerseWidgetContent />;
    case 'chores':
      return <ChoresWidgetContent />;
  }
}

function backgroundFor(id: WidgetId, theme: ReturnType<typeof useTheme>) {
  switch (id) {
    case 'calendar':
      return theme.colors.calBg;
    case 'meal':
      return theme.colors.mealBg;
    case 'todo':
    case 'challenge':
      return theme.colors.boardsBg;
    case 'verse':
      return theme.colors.verseBg;
    case 'chores':
      return theme.colors.choresBg;
    default:
      return theme.colors.panel;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hint: { paddingHorizontal: 24, fontSize: 11.5, marginBottom: 6 },
  grid: { flex: 1, minHeight: 0, paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  gridRow: { flexDirection: 'row', gap: 16, minHeight: 0 },
  gridCol: { flexDirection: 'column', gap: 16, minHeight: 0 },
  cell: { minHeight: 0 },
  stackedScroll: { flex: 1, minHeight: 0 },
  stackedContent: { paddingHorizontal: 24, paddingBottom: 24 },
  stackedItem: { minHeight: 230, marginBottom: 16 },
});