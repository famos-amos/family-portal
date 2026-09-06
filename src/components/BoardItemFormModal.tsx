// Shared "Add/Edit Item" popup for board-style item lists. Boards' own
// columns (Family To-Do, Wishlist, Shopping List) and Meal Plans' Grocery
// List both display the exact same underlying data (a BoardItem — the
// Grocery List screen is just a focused view onto the "shopping" board
// column, see GroceryListScreen.tsx), so they share this one modal rather
// than each keeping a near-duplicate copy — a field added here (like
// auto-delete) shows up on both automatically.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useFamilyStore } from '../store/useAppStore';
import { BoardAutoDelete, BoardItem } from '../store/types';

const AUTO_DELETE_OPTIONS: { value: BoardAutoDelete | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 'immediately', label: 'Immediately' },
  { value: '72h', label: '72 Hours' },
  { value: 'month', label: '1 Month' },
  { value: 'year', label: '1 Year' },
];

export function BoardItemFormModal({
  mode,
  visible,
  initial,
  titlePlaceholder = 'Title',
  descriptionPlaceholder = 'Description (optional)',
  onClose,
  onSave,
  onDelete,
}: {
  mode: 'add' | 'edit';
  visible: boolean;
  initial: BoardItem | undefined;
  /** Lets each screen phrase the title field for its own context (Boards'
   * generic "Title" vs. Grocery List's "Item (e.g. Milk)") without forking
   * the whole modal. */
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  onClose: () => void;
  onSave: (patch: { title: string; description?: string; ownerId?: string; autoDelete?: BoardAutoDelete | null }) => void;
  onDelete: (() => void) | undefined;
}) {
  const theme = useTheme();
  const family = useFamilyStore((s) => s.members);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [autoDelete, setAutoDelete] = useState<BoardAutoDelete | null>(null);

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setDescription(initial?.description ?? '');
      setOwnerId(initial?.ownerId ?? undefined);
      setAutoDelete(initial?.autoDelete ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 14 }}>
            {mode === 'edit' ? 'Edit Item' : 'Add Item'}
          </Text>
          <TextInput
            placeholder={titlePlaceholder}
            placeholderTextColor={theme.colors.inkSoft}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />
          <TextInput
            placeholder={descriptionPlaceholder}
            placeholderTextColor={theme.colors.inkSoft}
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {family.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setOwnerId(ownerId === m.id ? undefined : m.id)}
                style={[styles.personChip, { backgroundColor: ownerId === m.id ? m.color : theme.colors.fieldBg }]}
              >
                <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: ownerId === m.id ? '#fff' : theme.colors.ink }}>
                  {m.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.colors.inkSoft }]}>Delete automatically after it's checked off</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {AUTO_DELETE_OPTIONS.map((opt) => {
              const active = autoDelete === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => setAutoDelete(opt.value)}
                  style={[styles.personChip, { backgroundColor: active ? theme.colors.boardsDk : theme.colors.fieldBg }]}
                >
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: active ? '#fff' : theme.colors.ink }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {onDelete && (
              <Pressable onPress={onDelete} style={[styles.modalBtn, { backgroundColor: theme.colors.danger + '22', flex: 0.7 }]}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.danger }}>Delete</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.colors.fieldBg }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!title.trim()}
              onPress={() => onSave({ title: title.trim(), description: description.trim() || undefined, ownerId, autoDelete })}
              style={[styles.modalBtn, { backgroundColor: theme.colors.ink, opacity: title.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff' }}>{mode === 'edit' ? 'Save' : 'Add'}</Text>
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
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  personChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});