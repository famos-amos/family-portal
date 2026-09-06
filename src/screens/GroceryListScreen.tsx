import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useBoardsStore, useFamilyStore } from '../store/useAppStore';
import { EditIcon, PlusIcon } from '../components/icons';
import { Checkbox, PrimaryButton } from '../components/ui';
import { BoardItemFormModal } from '../components/BoardItemFormModal';
import { BoardItem } from '../store/types';
import { confirmAction } from '../lib/alerts';

// The Meal Plans "Grocery List" quick-link lands here rather than on the
// Boards screen. It's still the same underlying data (the "Shopping List"
// board column) so adding milk here or on Boards keeps everything in sync —
// this screen just gives grocery shopping its own focused, full-page view.
const SHOPPING_COLUMN_ID = 'shopping';

export function GroceryListScreen() {
  const theme = useTheme();
  const columns = useBoardsStore((s) => s.columns);
  const items = useBoardsStore((s) => s.items);
  const toggleItem = useBoardsStore((s) => s.toggleItem);
  const addItem = useBoardsStore((s) => s.addItem);
  const updateItem = useBoardsStore((s) => s.updateItem);
  const removeItem = useBoardsStore((s) => s.removeItem);
  const family = useFamilyStore((s) => s.members);

  const column = columns.find((c) => c.id === SHOPPING_COLUMN_ID);
  const listItems = items.filter((i) => i.columnId === SHOPPING_COLUMN_ID);
  const remaining = listItems.filter((i) => !i.done).length;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BoardItem | null>(null);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <View style={styles.toolbar}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink }}>Grocery List</Text>
        <View style={[styles.countPill, { backgroundColor: theme.colors.boardsBg }]}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12.5, color: theme.colors.boardsDk }}>
            {remaining} left to buy
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Add Item"
          color={theme.colors.boardsDk}
          icon={<PlusIcon size={15} color="#fff" />}
          onPress={() => setAdding(true)}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {listItems.length === 0 && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft, paddingHorizontal: 24 }}>
            The list is empty — add something above.
          </Text>
        )}
        {listItems.map((item) => {
          const owner = family.find((f) => f.id === item.ownerId);
          return (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: theme.colors.panel }]}>
              <Checkbox checked={item.done} onPress={() => toggleItem(item.id)} color={theme.colors.boardsDk} />
              <View style={{ flex: 1 }}>
                <View style={styles.itemTopRow}>
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyBold,
                      fontSize: 14.5,
                      color: theme.colors.ink,
                      textDecorationLine: item.done ? 'line-through' : 'none',
                      opacity: item.done ? 0.5 : 1,
                      flex: 1,
                    }}
                  >
                    {item.title}
                  </Text>
                  {owner && (
                    <View style={[styles.ownerTag, { backgroundColor: owner.color }]}>
                      <Text style={{ color: '#fff', fontFamily: theme.fonts.headSemiBold, fontSize: 10 }}>{owner.name}</Text>
                    </View>
                  )}
                </View>
                {item.description && (
                  <Text style={{ fontSize: 11.5, color: theme.colors.inkSoft, marginTop: 3, fontFamily: theme.fonts.body }}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setEditing(item)} hitSlop={8} style={styles.editBtn}>
                <EditIcon size={14} color={theme.colors.inkSoft} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <BoardItemFormModal
        mode="add"
        visible={adding}
        initial={undefined}
        titlePlaceholder="Item (e.g. Milk)"
        descriptionPlaceholder="Note (optional)"
        onClose={() => setAdding(false)}
        onSave={(patch) => {
          if (!column) return;
          addItem({ columnId: column.id, ...patch });
          setAdding(false);
        }}
        onDelete={undefined}
      />

      <BoardItemFormModal
        mode="edit"
        visible={editing !== null}
        initial={editing ?? undefined}
        titlePlaceholder="Item (e.g. Milk)"
        descriptionPlaceholder="Note (optional)"
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          updateItem(editing.id, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (!editing) return;
          confirmAction('Remove item?', `Remove "${editing.title}" from the list?`, 'Remove', () => {
            removeItem(editing.id);
            setEditing(null);
          }, { destructive: true });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingBottom: 12 },
  countPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  list: { paddingHorizontal: 24, paddingBottom: 24, gap: 10, maxWidth: 640 },
  itemCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 14 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  editBtn: { paddingLeft: 4, paddingTop: 2 },
});