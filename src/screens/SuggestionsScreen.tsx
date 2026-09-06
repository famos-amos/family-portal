import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useFamilyStore, useMealsStore, useSuggestionsStore } from '../store/useAppStore';
import { PlusIcon, StarIcon, TrashIcon } from '../components/icons';
import { AssignToPlanModal } from '../components/AssignToPlanModal';
import { assignMealToPlan } from '../lib/assignMeal';
import { notify } from '../lib/alerts';
import { DayOfWeek, MealSlotType, MealSuggestion } from '../store/types';

// What's being assigned a day/slot via AssignToPlanModal — the same modal
// serves three slightly different origins, so onConfirm knows what else (if
// anything) to do with the suggestions list besides updating the plan.
type AssignTarget =
  | { kind: 'reuse'; name: string }
  | { kind: 'newSuggestion'; name: string; suggestedByIds: string[] }
  | { kind: 'existingSuggestion'; suggestion: MealSuggestion };

const DAY_LABEL: Record<DayOfWeek, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
const SLOT_LABEL: Record<MealSlotType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export function SuggestionsScreen() {
  const theme = useTheme();
  const meals = useMealsStore((s) => s.meals);
  const upsertMeal = useMealsStore((s) => s.upsertMeal);
  const family = useFamilyStore((s) => s.members);
  const suggestions = useSuggestionsStore((s) => s.suggestions);
  const addSuggestion = useSuggestionsStore((s) => s.addSuggestion);
  const updateSuggestion = useSuggestionsStore((s) => s.updateSuggestion);
  const removeSuggestion = useSuggestionsStore((s) => s.removeSuggestion);

  const [customName, setCustomName] = useState('');
  const [suggestedByIds, setSuggestedByIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState<AssignTarget | null>(null);

  // "Existing meal" reuse: distinct names already used somewhere in the plan,
  // most-recent-ish first, so a family can quickly re-schedule a favorite
  // instead of retyping it.
  const existingNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const m of meals) {
      if (!seen.has(m.name)) {
        seen.add(m.name);
        names.push(m.name);
      }
    }
    return names;
  }, [meals]);

  // Newest ideas first, so a fresh suggestion doesn't get buried at the
  // bottom of a long-running list.
  const ideas = useMemo(() => [...suggestions].reverse(), [suggestions]);

  const assignName = assigning
    ? assigning.kind === 'existingSuggestion'
      ? assigning.suggestion.name
      : assigning.name
    : '';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <View style={styles.toolbar}>
        <StarIcon size={18} color={theme.colors.mealDk} filled={false} />
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink }}>Suggestions</Text>
      </View>
      <Text style={[styles.hint, { color: theme.colors.inkSoft, fontFamily: theme.fonts.body }]}>
        Suggest a new meal or reuse an old favorite. Picking a day is optional — save it as an idea for later, or schedule it right away.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 14.5, color: theme.colors.ink, marginBottom: 10 }}>
            Suggest a meal
          </Text>
          <TextInput
            placeholder="New meal name…"
            placeholderTextColor={theme.colors.inkSoft}
            value={customName}
            onChangeText={setCustomName}
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />

          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 10.5, color: theme.colors.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Who's suggesting? (optional, tap to select any number)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {family.map((m) => {
              const active = suggestedByIds.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() =>
                    setSuggestedByIds((prev) => (prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]))
                  }
                  style={[styles.personChip, { backgroundColor: active ? m.color : theme.colors.fieldBg }]}
                >
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: active ? '#fff' : theme.colors.ink }}>
                    {m.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Pressable
              disabled={!customName.trim()}
              onPress={() => {
                const name = customName.trim();
                addSuggestion({ name, suggestedByIds, day: null, slot: null });
                setCustomName('');
                setSuggestedByIds([]);
                notify('Suggestion saved', `${name} was added to Meal Ideas.`);
              }}
              style={[styles.addBtn, { backgroundColor: theme.colors.mealDk, opacity: customName.trim() ? 1 : 0.4 }]}
            >
              <PlusIcon size={14} color="#fff" />
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff', fontSize: 13 }}>Save Suggestion</Text>
            </Pressable>
            <Pressable
              disabled={!customName.trim()}
              onPress={() => setAssigning({ kind: 'newSuggestion', name: customName.trim(), suggestedByIds })}
              style={[styles.addBtnOutline, { borderColor: theme.colors.mealDk, opacity: customName.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.mealDk, fontSize: 13 }}>
                …or pick a day now
              </Text>
            </Pressable>
          </View>

          {existingNames.length > 0 && (
            <>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 18, marginBottom: 8 }}>
                Or reuse a favorite
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {existingNames.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => setAssigning({ kind: 'reuse', name })}
                    style={[styles.nameChip, { backgroundColor: theme.colors.fieldBg }]}
                  >
                    <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.ink }}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 14.5, color: theme.colors.ink, marginTop: 20, marginBottom: 10 }}>
          Meal ideas
        </Text>
        {ideas.length === 0 && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft }}>
            No ideas yet — suggest one above.
          </Text>
        )}
        {ideas.map((idea) => {
          const suggesters = family.filter((m) => idea.suggestedByIds.includes(m.id));
          const scheduled = !!idea.day && !!idea.slot;
          return (
            <View key={idea.id} style={[styles.ideaCard, { backgroundColor: theme.colors.panel }]}>
              <View style={[styles.typeIcon, { backgroundColor: theme.colors.mealBg }]}>
                <StarIcon size={13} color={theme.colors.mealDk} filled={false} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13.5, color: theme.colors.ink }}>{idea.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                  {suggesters.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {suggesters.map((p) => (
                        <View key={p.id} style={[styles.suggesterDot, { backgroundColor: p.color }]} />
                      ))}
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.inkSoft }}>
                        Suggested by {suggesters.map((p) => p.name).join(', ')}
                      </Text>
                    </View>
                  )}
                  {scheduled && (
                    <View style={[styles.scheduledPill, { backgroundColor: theme.colors.mealBg }]}>
                      <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 10.5, color: theme.colors.mealDk }}>
                        {DAY_LABEL[idea.day as DayOfWeek]} · {SLOT_LABEL[idea.slot as MealSlotType]}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {!scheduled && (
                <Pressable
                  onPress={() => setAssigning({ kind: 'existingSuggestion', suggestion: idea })}
                  style={[styles.pickDayBtn, { backgroundColor: theme.colors.mealDk }]}
                >
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff', fontSize: 11.5 }}>Pick a Day</Text>
                </Pressable>
              )}
              <Pressable onPress={() => removeSuggestion(idea.id)} hitSlop={8} style={styles.removeBtn}>
                <TrashIcon size={14} color={theme.colors.inkSoft} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <AssignToPlanModal
        visible={assigning !== null}
        mealName={assignName}
        onClose={() => setAssigning(null)}
        onConfirm={(day, slot) => {
          if (!assigning) return;
          const name = assignName;
          assignMealToPlan({ meals, upsertMeal, name, day, slot });
          if (assigning.kind === 'newSuggestion') {
            addSuggestion({ name, suggestedByIds: assigning.suggestedByIds, day, slot });
            setCustomName('');
            setSuggestedByIds([]);
          } else if (assigning.kind === 'existingSuggestion') {
            updateSuggestion(assigning.suggestion.id, { day, slot });
          }
          setAssigning(null);
          notify('Added to plan', `${name} is on the calendar.`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 2, paddingBottom: 4 },
  hint: { paddingHorizontal: 24, fontSize: 12, marginBottom: 12 },
  content: { paddingHorizontal: 24, paddingBottom: 24, maxWidth: 680 },
  card: { borderRadius: 18, padding: 18 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, fontSize: 14 },
  personChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  addBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2 },
  nameChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  ideaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 10, marginBottom: 8 },
  typeIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  suggesterDot: { width: 8, height: 8, borderRadius: 4 },
  scheduledPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pickDayBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  removeBtn: { padding: 6 },
});