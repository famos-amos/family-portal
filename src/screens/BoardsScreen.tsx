import React, { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useBoardsStore, useFamilyStore } from '../store/useAppStore';
import { EditIcon, PlusIcon } from '../components/icons';
import { Checkbox, PrimaryButton } from '../components/ui';
import { personColorOptions } from '../theme/colors';
import { BoardAutoDelete, BoardItem } from '../store/types';
import { confirmAction } from '../lib/alerts';

const AUTO_DELETE_OPTIONS: { value: BoardAutoDelete | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 'immediately', label: 'Immediately' },
  { value: '72h', label: '72 Hours' },
  { value: 'month', label: '1 Month' },
  { value: 'year', label: '1 Year' },
];

export function BoardsScreen() {
  const theme = useTheme();
  const columns = useBoardsStore((s) => s.columns);
  const items = useBoardsStore((s) => s.items);
  const toggleItem = useBoardsStore((s) => s.toggleItem);
  const addItem = useBoardsStore((s) => s.addItem);
  const updateItem = useBoardsStore((s) => s.updateItem);
  const removeItem = useBoardsStore((s) => s.removeItem);
  const addColumn = useBoardsStore((s) => s.addColumn);
  const family = useFamilyStore((s) => s.members);

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<BoardItem | null>(null);
  const [newColumnOpen, setNewColumnOpen] = useState(false);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="New Board"
          color={theme.colors.boardsDk}
          icon={<PlusIcon size={15} color="#fff" />}
          onPress={() => setNewColumnOpen(true)}
        />
      </View>

      <ScrollView horizontal style={styles.scroll} contentContainerStyle={styles.board}>
        {columns.map((col) => {
          const colItems = items.filter((i) => i.columnId === col.id);
          return (
            <View key={col.id} style={[styles.col, { backgroundColor: col.color + '1A' }]}>
              <View style={styles.colHead}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: col.color }}>{col.title}</Text>
                <View style={[styles.countBadge, { backgroundColor: theme.isDark ? '#FFFFFF20' : '#ffffffa0' }]}>
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 11, color: theme.colors.ink }}>
                    {colItems.length}
                  </Text>
                </View>
              </View>

              {colItems.map((item) => {
                const owner = family.find((f) => f.id === item.ownerId);
                return (
                  <View key={item.id} style={[styles.itemCard, { backgroundColor: theme.colors.panel }]}>
                    <Checkbox checked={item.done} onPress={() => toggleItem(item.id)} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTopRow}>
                        <Text
                          style={{
                            fontFamily: theme.fonts.bodyBold,
                            fontSize: 14,
                            color: theme.colors.ink,
                            textDecorationLine: item.done ? 'line-through' : 'none',
                            opacity: item.done ? 0.55 : 1,
                            flex: 1,
                          }}
                        >
                          {item.title}
                        </Text>
                        {owner && (
                          <View style={[styles.ownerTag, { backgroundColor: owner.color }]}>
                            <Text style={{ color: '#fff', fontFamily: theme.fonts.headSemiBold, fontSize: 10 }}>
                              {owner.name}
                            </Text>
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
                      <EditIcon size={13} color={theme.colors.inkSoft} />
                    </Pressable>
                  </View>
                );
              })}

              <Pressable
                onPress={() => setAddingTo(col.id)}
                style={[styles.fab, { backgroundColor: col.color, alignSelf: 'center', marginTop: 8 }]}
              >
                <PlusIcon size={17} color="#fff" />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <ItemFormModal
        mode="add"
        visible={addingTo !== null}
        initial={undefined}
        onClose={() => setAddingTo(null)}
        onSave={(patch) => {
          if (!addingTo) return;
          addItem({ columnId: addingTo, ...patch });
          setAddingTo(null);
        }}
        onDelete={undefined}
      />

      <ItemFormModal
        mode="edit"
        visible={editing !== null}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          updateItem(editing.id, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (!editing) return;
          confirmAction('Delete item?', `Remove "${editing.title}" for good?`, 'Delete', () => {
            removeItem(editing.id);
            setEditing(null);
          }, { destructive: true });
        }}
      />

      <NewColumnModal
        visible={newColumnOpen}
        onClose={() => setNewColumnOpen(false)}
        onSave={(title, color) => {
          addColumn({ title, color });
          setNewColumnOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function ItemFormModal({
  mode,
  visible,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  mode: 'add' | 'edit';
  visible: boolean;
  initial: BoardItem | undefined;
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

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 14 }}>
            {mode === 'edit' ? 'Edit Item' : 'Add Item'}
          </Text>
          <TextInput
            placeholder="Title"
            placeholderTextColor={theme.colors.inkSoft}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />
          <TextInput
            placeholder="Description (optional)"
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

function NewColumnModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string>(personColorOptions[0]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 14 }}>
            New Board
          </Text>
          <TextInput
            placeholder="Board name"
            placeholderTextColor={theme.colors.inkSoft}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
            {personColorOptions.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.swatch, { backgroundColor: c }, color === c && { borderWidth: 3, borderColor: theme.colors.ink }]}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.colors.fieldBg }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!title.trim()}
              onPress={() => onSave(title.trim(), color)}
              style={[styles.modalBtn, { backgroundColor: theme.colors.ink, opacity: title.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff' }}>Create</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 10 },
  board: { paddingHorizontal: 24, paddingBottom: 24, gap: 18 },
  col: { width: 300, borderRadius: 22, padding: 16, gap: 10 },
  colHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  itemCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 12 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  editBtn: { paddingLeft: 4, paddingTop: 2 },
  fab: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 420, borderRadius: 24, padding: 22 },
  label: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  personChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});