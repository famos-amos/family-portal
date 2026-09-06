import React, { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useMealsStore, useRecipesStore } from '../store/useAppStore';
import { BookIcon, ChevronRightIcon, EditIcon, MealIcon, PlusIcon, TrashIcon } from '../components/icons';
import { PrimaryButton, SegmentedControl } from '../components/ui';
import { AssignToPlanModal } from '../components/AssignToPlanModal';
import { assignMealToPlan } from '../lib/assignMeal';
import { notify, confirmAction } from '../lib/alerts';
import { Ingredient, MealSlotType, Recipe } from '../store/types';

const SLOT_LABEL: Record<MealSlotType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export function RecipesScreen() {
  const theme = useTheme();
  const meals = useMealsStore((s) => s.meals);
  const upsertMeal = useMealsStore((s) => s.upsertMeal);
  const recipes = useRecipesStore((s) => s.recipes);
  const addRecipe = useRecipesStore((s) => s.addRecipe);
  const updateRecipe = useRecipesStore((s) => s.updateRecipe);
  const removeRecipe = useRecipesStore((s) => s.removeRecipe);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <View style={styles.toolbar}>
        <BookIcon size={18} color={theme.colors.mealDk} />
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink }}>Recipes</Text>
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Add Recipe"
          color={theme.colors.mealDk}
          icon={<PlusIcon size={15} color="#fff" />}
          onPress={() => setEditing('new')}
        />
      </View>
      <Text style={[styles.hint, { color: theme.colors.inkSoft, fontFamily: theme.fonts.body }]}>
        Tap a recipe to see ingredients and steps, or add it straight to the weekly plan.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {recipes.map((recipe) => {
          const expanded = expandedId === recipe.id;
          return (
            <View key={recipe.id} style={[styles.card, { backgroundColor: theme.colors.panel }]}>
              <Pressable style={styles.cardHead} onPress={() => setExpandedId(expanded ? null : recipe.id)}>
                <View style={[styles.typeIcon, { backgroundColor: theme.colors.mealBg }]}>
                  <MealIcon size={15} color={theme.colors.mealDk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
                    {recipe.name}
                  </Text>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 }}>
                    {SLOT_LABEL[recipe.slot]} · {recipe.time}
                  </Text>
                </View>
                <Pressable onPress={() => setEditing(recipe)} hitSlop={8} style={styles.editBtn}>
                  <EditIcon size={14} color={theme.colors.inkSoft} />
                </Pressable>
                <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                  <ChevronRightIcon size={16} color={theme.colors.inkSoft} />
                </View>
              </Pressable>

              {expanded && (
                <View style={styles.detail}>
                  <Text style={[styles.detailLabel, { color: theme.colors.inkSoft }]}>Ingredients</Text>
                  {recipe.ingredients.map((ing, i) => (
                    <View key={i} style={styles.ingredientRow}>
                      <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.mealDk, width: 96 }}>
                        {ing.amount}
                      </Text>
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.ink, flex: 1 }}>
                        {ing.name}
                      </Text>
                    </View>
                  ))}
                  <Text style={[styles.detailLabel, { color: theme.colors.inkSoft, marginTop: 12 }]}>Steps</Text>
                  {recipe.steps.map((step, i) => (
                    <Text key={i} style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.ink, marginBottom: 6 }}>
                      {i + 1}. {step}
                    </Text>
                  ))}
                  <Pressable
                    onPress={() => setAssigning(recipe)}
                    style={[styles.addBtn, { backgroundColor: theme.colors.mealDk }]}
                  >
                    <PlusIcon size={14} color="#fff" />
                    <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff', fontSize: 13 }}>Add to Plan</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        {recipes.length === 0 && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft }}>
            No recipes yet — add your first one above.
          </Text>
        )}
      </ScrollView>

      <AssignToPlanModal
        visible={assigning !== null}
        mealName={assigning?.name ?? ''}
        defaultSlot={assigning?.slot}
        onClose={() => setAssigning(null)}
        onConfirm={(day, slot) => {
          if (!assigning) return;
          assignMealToPlan({ meals, upsertMeal, name: assigning.name, day, slot });
          setAssigning(null);
          notify('Added to plan', `${assigning.name} is on the calendar.`);
        }}
      />

      <RecipeFormModal
        visible={editing !== null}
        initial={editing && editing !== 'new' ? editing : undefined}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing === 'new') {
            addRecipe(patch);
          } else if (editing) {
            updateRecipe(editing.id, patch);
          }
          setEditing(null);
        }}
        onDelete={
          editing && editing !== 'new'
            ? () => {
                const recipe = editing;
                confirmAction('Delete recipe?', `Remove "${recipe.name}" from the library?`, 'Delete', () => {
                  removeRecipe(recipe.id);
                  setEditing(null);
                }, { destructive: true });
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}

function RecipeFormModal({
  visible,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: Recipe | undefined;
  onClose: () => void;
  onSave: (patch: { name: string; slot: MealSlotType; time: string; ingredients: Ingredient[]; steps: string[] }) => void;
  onDelete: (() => void) | undefined;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [slot, setSlot] = useState<MealSlotType>('dinner');
  const [time, setTime] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ amount: '', name: '' }]);
  const [steps, setSteps] = useState<string[]>(['']);

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setSlot(initial?.slot ?? 'dinner');
      setTime(initial?.time ?? '');
      setIngredients(initial?.ingredients && initial.ingredients.length > 0 ? initial.ingredients : [{ amount: '', name: '' }]);
      setSteps(initial?.steps && initial.steps.length > 0 ? initial.steps : ['']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const updateIngredient = (i: number, patch: Partial<Ingredient>) =>
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, text: string) => setSteps((prev) => prev.map((s, idx) => (idx === i ? text : s)));
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const canSave = name.trim().length > 0;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ScrollView contentContainerStyle={styles.modalScrollWrap} style={{ maxHeight: '90%', width: 480 }}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 14 }}>
              {initial ? 'Edit Recipe' : 'Add Recipe'}
            </Text>

            <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Name</Text>
            <TextInput
              placeholder="Recipe name"
              placeholderTextColor={theme.colors.inkSoft}
              value={name}
              onChangeText={setName}
              style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
            />

            <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Meal</Text>
            <View style={{ marginBottom: 12 }}>
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

            <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Time</Text>
            <TextInput
              placeholder="e.g. 30 min"
              placeholderTextColor={theme.colors.inkSoft}
              value={time}
              onChangeText={setTime}
              style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
            />

            <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Ingredients</Text>
            {ingredients.map((ing, i) => (
              <View key={i} style={styles.ingredientEditRow}>
                <TextInput
                  placeholder="Amount"
                  placeholderTextColor={theme.colors.inkSoft}
                  value={ing.amount}
                  onChangeText={(v) => updateIngredient(i, { amount: v })}
                  style={[styles.input, styles.amountInput, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
                />
                <TextInput
                  placeholder="Ingredient"
                  placeholderTextColor={theme.colors.inkSoft}
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(i, { name: v })}
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
                />
                <Pressable onPress={() => removeIngredient(i)} hitSlop={8} style={styles.rowRemoveBtn}>
                  <TrashIcon size={15} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setIngredients((prev) => [...prev, { amount: '', name: '' }])} style={styles.addRowBtn}>
              <PlusIcon size={12} color={theme.colors.mealDk} />
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12.5, color: theme.colors.mealDk }}>
                Add Ingredient
              </Text>
            </Pressable>

            <Text style={[styles.label, { color: theme.colors.inkSoft, marginTop: 14 }]}>Steps</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.ingredientEditRow}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.inkSoft, width: 20, paddingTop: 12 }}>
                  {i + 1}.
                </Text>
                <TextInput
                  placeholder={`Step ${i + 1}`}
                  placeholderTextColor={theme.colors.inkSoft}
                  value={step}
                  onChangeText={(v) => updateStep(i, v)}
                  multiline
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.fieldBg, color: theme.colors.ink, minHeight: 40 }]}
                />
                <Pressable onPress={() => removeStep(i)} hitSlop={8} style={styles.rowRemoveBtn}>
                  <TrashIcon size={15} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setSteps((prev) => [...prev, ''])} style={styles.addRowBtn}>
              <PlusIcon size={12} color={theme.colors.mealDk} />
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12.5, color: theme.colors.mealDk }}>Add Step</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              {onDelete && (
                <Pressable onPress={onDelete} style={[styles.modalBtn, { backgroundColor: theme.colors.danger + '22', flex: 0.7 }]}>
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.danger }}>Delete</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.colors.fieldBg }]}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!canSave}
                onPress={() =>
                  onSave({
                    name: name.trim(),
                    slot,
                    time: time.trim() || '—',
                    ingredients: ingredients
                      .map((ing) => ({ amount: ing.amount.trim(), name: ing.name.trim() }))
                      .filter((ing) => ing.name.length > 0),
                    steps: steps.map((s) => s.trim()).filter((s) => s.length > 0),
                  })
                }
                style={[styles.modalBtn, { backgroundColor: theme.colors.mealDk, opacity: canSave ? 1 : 0.4 }]}
              >
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff' }}>{initial ? 'Save' : 'Add'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 2, paddingBottom: 4 },
  hint: { paddingHorizontal: 24, fontSize: 12, marginBottom: 12 },
  list: { paddingHorizontal: 24, paddingBottom: 24, gap: 12, maxWidth: 680 },
  card: { borderRadius: 18, padding: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  typeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  editBtn: { padding: 4 },
  detail: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  detailLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  ingredientRow: { flexDirection: 'row', marginBottom: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 16 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalScrollWrap: { alignItems: 'center' },
  modalCard: { width: 480, borderRadius: 24, padding: 22 },
  label: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  amountInput: { width: 100 },
  ingredientEditRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  rowRemoveBtn: { padding: 10 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginBottom: 4, paddingVertical: 4 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});