// Wraps each of the 5 main tab screens (Home, Calendar, Chores, MealPlans,
// Boards) so that on the narrow/mobile layout, a horizontal swipe anywhere on
// the screen moves to the next/previous tab in MAIN_TAB_ORDER — wrapping
// around at both ends, so swiping forward from Boards lands back on Home,
// and backward from Home lands on Boards.
//
// This intentionally reuses the exact same `navigation.navigate(name)` call
// the TopBar's tab pills already make, rather than building a separate
// content-pager that duplicates each screen outside the navigator — so every
// existing navigation call, deep link (e.g. the home dashboard's "Today's
// Events" card jumping into Calendar's Day view with params), and back
// button keeps working completely unchanged. The tradeoff is that a swipe
// triggers the stack navigator's own screen transition rather than a finger-
// tracking drag animation.
//
// No-ops entirely on the wide/desktop layout (gated by NARROW_BREAKPOINT) —
// desktop keeps using the tab bar only, as before.
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MAIN_TAB_ORDER, NARROW_BREAKPOINT } from '../lib/layout';

// How far (px) or how fast (px/s) a horizontal drag has to go before it
// counts as "swipe to the next tab" rather than an incidental wobble.
const DISTANCE_THRESHOLD = 60;
const VELOCITY_THRESHOLD = 650;

export function TabSwipeWrapper({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_BREAKPOINT;

  const tabIndex = (MAIN_TAB_ORDER as readonly string[]).indexOf(route.name);
  const canSwipe = narrow && tabIndex !== -1;

  const goToOffset = (delta: number) => {
    const n = MAIN_TAB_ORDER.length;
    const next = MAIN_TAB_ORDER[(tabIndex + delta + n) % n];
    navigation.navigate(next as never);
  };

  const pan = Gesture.Pan()
    .enabled(canSwipe)
    // Only claim the gesture once the drag is clearly horizontal — lets
    // each screen's own vertical ScrollView (month grid, agenda, board
    // columns, …) keep handling vertical drags normally.
    .activeOffsetX([-24, 24])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      const strongSwipeLeft = e.translationX < -DISTANCE_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD;
      const strongSwipeRight = e.translationX > DISTANCE_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD;
      if (strongSwipeLeft) runOnJS(goToOffset)(1);
      else if (strongSwipeRight) runOnJS(goToOffset)(-1);
    });

  if (!canSwipe) return <>{children}</>;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
