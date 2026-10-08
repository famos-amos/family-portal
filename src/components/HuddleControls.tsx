// Positions the Snap and Talk pills as a row in the top-right corner, next
// to the Settings gear — `right: 72` leaves room for the 38px gear + a gap,
// matching its vertical position via the same safe-area inset every screen's
// own <SafeAreaView> uses. Wrapping both in one flex row (rather than each
// pill computing its own fixed `right` offset) means adding/removing a
// button never requires re-measuring the other one's position.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SnapButton } from './SnapButton';
import { HuddleButton } from './HuddleButton';

export function HuddleControls() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { top: insets.top + 16 }]}>
      <SnapButton />
      <HuddleButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    right: 72,
    flexDirection: 'row',
    gap: 10,
  },
});
