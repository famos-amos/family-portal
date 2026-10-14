import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useDashboardLayoutStore } from '../store/useAppStore';
import { WidgetId } from '../store/types';
import { WidgetShell } from './home/WidgetShell';
import { NARROW_BREAKPOINT } from '../lib/layout';
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
// so in normal use the grid below is what's shown. Shared with TopBar so the
// header restacks at the same width the grid does.
const GRID_BREAKPOINT = NARROW_BREAKPOINT;

export function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const sizes = useDashboardLayoutStore((s) => s.sizes);
  const setSize = useDashboardLayoutStore((s) => s.setSize);

  const isGrid = width >= GRID_BREAKPOINT;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      {isGrid ? (
        <DashboardGrid sizes={sizes} setSize={setSize} />
      ) : (
        <ScrollView style={styles.stackedScroll} contentContainerStyle={styles.stackedContent}>
          {STACKED_ORDER.map((id) => (
            <View key={id} style={styles.stackedItem}>
              <WidgetShell
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
// internally within a fixed-size card (see TodoWidgetContent). Meal isn't
// either any more — it's a fixed 3-line yesterday/tonight/tomorrow layout
// now, nothing left to cycle through (see MealWidgetContent). Chores IS in
// this set — its per-person rings now actually resize with it (see
// CHORES_RING_SIZES in widgets.tsx).
const SIZED_WIDGETS = new Set<WidgetId>(['calendar', 'events', 'chores']);
const STACKED_ORDER: WidgetId[] = ['calendar', 'events', 'todo', 'verse', 'meal', 'challenge', 'chores'];

// 3 columns, left to right: Calendar alone (full height, the widest column —
// its own "breathing room"); Events/To Do stacked as equal halves; Verse/Meal
// Plan/Daily Challenge stacked as equal thirds. Chores stays its own
// full-width row underneath, unchanged by any of this, flush with the
// sidebar.
function DashboardGrid({
  sizes,
  setSize,
}: {
  sizes: Record<WidgetId, any>;
  setSize: (id: WidgetId, size: any) => void;
}) {
  const cell = (id: WidgetId, extraStyle?: object) => (
    <View style={[styles.cell, extraStyle]}>
      <WidgetShell
        size={SIZED_WIDGETS.has(id) ? sizes[id] : undefined}
        onCycleSize={SIZED_WIDGETS.has(id) ? (next) => setSize(id, next) : undefined}
      >
        {renderWidget(id, sizes[id])}
      </WidgetShell>
    </View>
  );

  return (
    <View style={styles.grid}>
      <View style={[styles.gridRow, { flex: 10 }]}>
        {cell('calendar', { flex: 1.4 })}
        <View style={[styles.gridCol, { flex: 1 }]}>
          {cell('events', { flex: 1 })}
          {cell('todo', { flex: 1 })}
        </View>
        <View style={[styles.gridCol, { flex: 1 }]}>
          {cell('verse', { flex: 1 })}
          {cell('meal', { flex: 1 })}
          {cell('challenge', { flex: 1 })}
        </View>
      </View>
      <View style={[styles.gridRow, { flex: 4 }]}>{cell('chores', { flex: 1 })}</View>
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
      return <MealWidgetContent />;
    case 'todo':
      return <TodoWidgetContent />;
    case 'challenge':
      return <ChallengeWidgetContent />;
    case 'verse':
      return <VerseWidgetContent />;
    case 'chores':
      return <ChoresWidgetContent size={size} />;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grid: { flex: 1, minHeight: 0, paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  gridRow: { flexDirection: 'row', gap: 16, minHeight: 0 },
  gridCol: { flexDirection: 'column', gap: 16, minHeight: 0 },
  cell: { minHeight: 0 },
  stackedScroll: { flex: 1, minHeight: 0 },
  stackedContent: { paddingHorizontal: 24, paddingBottom: 24 },
  stackedItem: { minHeight: 230, marginBottom: 16 },
});