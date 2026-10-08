// Shared "pick a day + meal slot" popup used by both the Recipes and
// Suggestions screens to schedule a meal (new or reused) into the weekly
// planner without leaving the current screen.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { SegmentedControl } from './ui';
import { WEEKDAY_LABELS, dayOfWeek } from '../lib/date';
import { DayOfWeek, MealSlotType } from '../store/types';
import { contrastText } from '../lib/contrastColor';

export function AssignToPlanModal({
  visible,
  mealName,
  defaultSlot = 'dinner',
  onClose,
  onConfirm,
}: {
  visible: boolean;
  mealName: string;
  defaultSlot?: MealSlotType;
  onClose: () => void;
  onConfirm: (day: DayOfWeek, slot: MealSlotType) => void;
}) {
  const theme = useTheme();
  const [day, setDay] = useState<DayOfWeek>(dayOfWeek());
  const [slot, setSlot] = useState<MealSlotType>(defaultSlot);

  useEffect(() => {
    if (visible) {
      setDay(dayOfWeek());
      setSlot(defaultSlot);
    }
  }, [visible, defaultSlot]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 4 }}>
            Add to Plan
          </Text>
          <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.mealDk, marginBottom: 16 }}>
            {mealName}
          </Text>

          <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Day</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {WEEKDAY_LABELS.map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setDay(key)}
                style={[styles.dayChip, { backgroundColor: day === key ? theme.colors.mealDk : theme.colors.fieldBg }]}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.headSemiBold,
                    fontSize: 12,
                    color: day === key ? contrastText(theme.colors.mealDk) : theme.colors.ink,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Meal</Text>
          <View style={{ marginBottom: 20 }}>
            <SegmentedControl
              value={slot}
              onChange={setSlot}
              options={[
                { value: 'breakfast', label: 'Breakfast' },
                { value: 'lunch', label: 'Lunch' },
                { value: 'dinner', label: 'Dinner' },
              ]}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.colors.fieldBg }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(day, slot)}
              style={[styles.modalBtn, { backgroundColor: theme.colors.mealDk }]}
            >
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: contrastText(theme.colors.mealDk) }}>Add to Plan</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 420, borderRadius: 24, padding: 22 },
  label: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});
