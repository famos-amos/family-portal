import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../theme/ThemeProvider';
import { useCalendarStore, useFamilyStore, useSettingsStore } from '../store/useAppStore';
import { CalendarEvent, FamilyMember } from '../store/types';
import {
  addDays,
  buildMonthGrid,
  buildWeekGrid,
  formatDayTitle,
  formatHalfHourLabel,
  formatMonthTitle,
  formatWeekTitle,
  parseClockTime,
  toIso,
  todayIso,
} from '../lib/date';
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../components/icons';
import { PrimaryButton, SegmentedControl } from '../components/ui';
import { confirmAction } from '../lib/alerts';
import { useColumnWidth } from '../lib/layout';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Half-hour row height for the Day agenda view — also referenced by
// DayAgenda's tap targets, event blocks, and the "now" indicator line.
const ROW_HEIGHT = 56;
const SLOT_COUNT = 48; // 24h * 2 half-hour slots
const AGENDA_GUTTER = 64; // width reserved for the time-of-day labels

export function CalendarScreen() {
  const theme = useTheme();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [prefillTime, setPrefillTime] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const events = useCalendarStore((s) => s.events);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const removeEvent = useCalendarStore((s) => s.removeEvent);
  const family = useFamilyStore((s) => s.members);
  const hidden = useSettingsStore((s) => s.hiddenPersonIds);
  const toggleVisibility = useSettingsStore((s) => s.togglePersonVisibility);

  const grid = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor.getFullYear(), cursor.getMonth()],
  );

  // Measured integer column width for the 7-across month/week grid — a
  // `${100 / 7}%` style wraps Saturday onto its own row in Expo Go (see
  // useColumnWidth).
  const [dayColWidth, onGridLayout] = useColumnWidth(7);
  const dayColStyle = dayColWidth != null ? { flexGrow: 0, flexShrink: 0, flexBasis: dayColWidth, width: dayColWidth } : null;

  const visibleEvents = events.filter((e) => e.personIds.length === 0 || e.personIds.some((id) => !hidden.includes(id)));

  const today = todayIso();
  const days = view === 'month' ? grid : view === 'week' ? buildWeekGrid(cursor) : [];

  // What Prev/Next mean, and what the header reads, both depend on which
  // view is active — a single browsable cursor rather than three separate
  // ones, so switching views keeps you looking at (roughly) the same date.
  const navigate = (delta: number) => {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (view === 'week') setCursor(addDays(cursor, delta * 7));
    else setCursor(addDays(cursor, delta));
  };
  const titleText = view === 'month' ? formatMonthTitle(cursor) : view === 'week' ? formatWeekTitle(cursor) : formatDayTitle(cursor);

  const anyHidden = family.some((m) => hidden.includes(m.id));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <View style={styles.toolbar}>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <View style={styles.monthTitle}>
          <Pressable onPress={() => navigate(-1)} style={styles.navBtn}>
            <ChevronLeftIcon size={13} color={theme.colors.ink} />
          </Pressable>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.colors.ink }}>
            {titleText}
          </Text>
          <Pressable onPress={() => navigate(1)} style={styles.navBtn}>
            <ChevronRightIcon size={13} color={theme.colors.ink} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.legend}>
          {family.map((m) => {
            const on = !hidden.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleVisibility(m.id)}
                style={[
                  styles.legendChip,
                  { backgroundColor: on ? (theme.isDark ? '#FFFFFF14' : '#FFFFFFB0') : 'transparent', opacity: on ? 1 : 0.45 },
                ]}
              >
                <View style={[styles.legendBox, on && { backgroundColor: m.color, borderColor: 'transparent' }]}>
                  {on && <CheckIcon size={10} color="#fff" />}
                </View>
                <Text
                  style={{
                    fontFamily: theme.fonts.headSemiBold,
                    fontSize: 12.5,
                    color: theme.colors.ink,
                    textDecorationLine: on ? 'none' : 'line-through',
                  }}
                >
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton
          label="Add Event"
          color={theme.colors.calDk}
          icon={<PlusIcon size={15} color="#fff" />}
          onPress={() => {
            setSelectedDate(view === 'day' ? toIso(cursor) : today);
            setPrefillTime(undefined);
            setAddOpen(true);
          }}
        />
      </View>

      {anyHidden && (
        <Text style={[styles.filterHint, { color: theme.colors.inkSoft, fontFamily: theme.fonts.bodyBold }]}>
          Tap a name above to show or hide their events — some calendars are hidden right now.
        </Text>
      )}

      {view === 'day' ? (
        <DayAgenda
          date={toIso(cursor)}
          events={visibleEvents.filter((e) => e.date === toIso(cursor))}
          family={family}
          onSelectEvent={(e) => setEditing(e)}
          onAddAt={(time) => {
            setSelectedDate(toIso(cursor));
            setPrefillTime(time);
            setAddOpen(true);
          }}
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.gridWrap}>
          <View style={[styles.gridCard, { backgroundColor: theme.colors.panel }]}>
            <View style={styles.dowRow}>
              {DOW.map((d) => (
                <Text
                  key={d}
                  style={[styles.dow, dayColStyle, { color: theme.colors.inkSoft, fontFamily: theme.fonts.headSemiBold }]}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.monthGrid} onLayout={onGridLayout}>
              {days.map(({ date, inMonth }, i) => {
                const iso = toIso(date);
                const isToday = iso === today;
                const dayEvents = visibleEvents.filter((e) => e.date === iso);
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setSelectedDate(iso);
                      setPrefillTime(undefined);
                      setAddOpen(true);
                    }}
                    style={[
                      styles.dayCell,
                      dayColStyle,
                      view === 'week' && styles.dayCellWeek,
                      { backgroundColor: theme.isDark ? '#FFFFFF08' : '#FBF7EF' },
                      isToday && { backgroundColor: theme.colors.calBg, borderWidth: 2, borderColor: theme.colors.cal },
                      !inMonth && view === 'month' && { opacity: 0.4 },
                    ]}
                  >
                    <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.ink }}>
                      {date.getDate()}
                    </Text>
                    {dayEvents.slice(0, view === 'week' ? 6 : 3).map((e) => {
                      const people = family.filter((m) => e.personIds.includes(m.id));
                      const chipColor = people[0]?.color ?? theme.colors.inkSoft;
                      return (
                        <Pressable
                          key={e.id}
                          // Tapping an event opens it for editing rather than
                          // the day's "add new event" modal — this Pressable
                          // being nested inside the day cell's own Pressable
                          // is enough for React Native's touch responder to
                          // award the tap to whichever one was actually
                          // touched.
                          onPress={() => setEditing(e)}
                          style={[styles.chip, { backgroundColor: chipColor + '30' }]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }}>
                            {people.length > 1 &&
                              people.slice(0, 4).map((p) => (
                                <View key={p.id} style={[styles.chipDot, { backgroundColor: p.color }]} />
                              ))}
                            <Text
                              numberOfLines={1}
                              style={{ fontSize: 9.5, fontFamily: theme.fonts.bodyBold, color: people[0]?.color ?? theme.colors.ink, flexShrink: 1 }}
                            >
                              {e.time ? `${e.time} ` : ''}
                              {e.title}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    {dayEvents.length > (view === 'week' ? 6 : 3) && (
                      <Text style={{ fontSize: 9, fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }}>
                        +{dayEvents.length - (view === 'week' ? 6 : 3)} more
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      <EventFormModal
        mode="add"
        visible={addOpen}
        date={selectedDate}
        initial={undefined}
        defaultTime={prefillTime}
        onClose={() => setAddOpen(false)}
        onSave={(patch) => {
          addEvent({
            date: selectedDate,
            title: patch.title,
            time: patch.time || undefined,
            endTime: patch.endTime || undefined,
            personIds: patch.personIds,
          });
          setAddOpen(false);
        }}
        onDelete={undefined}
      />

      <EventFormModal
        mode="edit"
        visible={editing !== null}
        date={editing?.date ?? selectedDate}
        initial={editing ?? undefined}
        defaultTime={undefined}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          updateEvent(editing.id, {
            title: patch.title,
            time: patch.time || undefined,
            endTime: patch.endTime || undefined,
            personIds: patch.personIds,
          });
          setEditing(null);
        }}
        onDelete={() => {
          if (!editing) return;
          confirmAction('Delete event?', `Remove "${editing.title}" from the calendar?`, 'Delete', () => {
            removeEvent(editing.id);
            setEditing(null);
          }, { destructive: true });
        }}
      />
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------
// Day agenda view — a scrollable schedule for one day, with a half-hour
// ruler down the left side and events laid out (and sized, when an end
// time is set) against it. Events that overlap in time will visually
// overlap too — this is a simple single-column agenda, not a full
// side-by-side calendar layout engine.
// -----------------------------------------------------------------------
function DayAgenda({
  date,
  events,
  family,
  onSelectEvent,
  onAddAt,
}: {
  date: string;
  events: CalendarEvent[];
  family: FamilyMember[];
  onSelectEvent: (e: CalendarEvent) => void;
  onAddAt: (time: string) => void;
}) {
  const theme = useTheme();
  const scrollRef = React.useRef<ScrollView>(null);
  const isToday = date === todayIso();

  // Land the scroll position somewhere useful on open/day-change rather than
  // always starting at midnight: near "now" for today, mid-morning otherwise.
  React.useEffect(() => {
    const now = new Date();
    const anchorMinutes = isToday ? Math.max(now.getHours() * 60 + now.getMinutes() - 90, 0) : 7 * 60;
    const y = (anchorMinutes / 30) * ROW_HEIGHT;
    const id = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const timed = events.filter((e) => e.time);
  const allDay = events.filter((e) => !e.time);

  return (
    <ScrollView ref={scrollRef} style={styles.agendaScroll} contentContainerStyle={{ paddingBottom: 24 }}>
      {allDay.length > 0 && (
        <View style={[styles.allDayRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.allDayLabel, { color: theme.colors.inkSoft, fontFamily: theme.fonts.headSemiBold }]}>
            All day
          </Text>
          <View style={{ flex: 1, gap: 6, flexWrap: 'wrap', flexDirection: 'row' }}>
            {allDay.map((e) => {
              const people = family.filter((m) => e.personIds.includes(m.id));
              const color = people[0]?.color ?? theme.colors.inkSoft;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => onSelectEvent(e)}
                  style={[styles.allDayChip, { backgroundColor: color + '30' }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {people.length > 1 &&
                      people.slice(0, 4).map((p) => <View key={p.id} style={[styles.chipDot, { backgroundColor: p.color }]} />)}
                    <Text style={{ fontSize: 11.5, fontFamily: theme.fonts.bodyBold, color: people[0]?.color ?? theme.colors.ink }}>
                      {e.title}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ height: SLOT_COUNT * ROW_HEIGHT, paddingHorizontal: 24 }}>
        <View style={{ height: '100%', position: 'relative' }}>
          {Array.from({ length: SLOT_COUNT }).map((_, i) => (
            <View
              key={`row-${i}`}
              style={[
                styles.agendaRow,
                { top: i * ROW_HEIGHT, height: ROW_HEIGHT, borderTopColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.agendaTimeLabel, { color: theme.colors.inkSoft }]}>{formatHalfHourLabel(i)}</Text>
            </View>
          ))}

          {Array.from({ length: SLOT_COUNT }).map((_, i) => (
            <Pressable
              key={`tap-${i}`}
              onPress={() => onAddAt(formatHalfHourLabel(i))}
              style={{ position: 'absolute', top: i * ROW_HEIGHT, left: AGENDA_GUTTER, right: 0, height: ROW_HEIGHT }}
            />
          ))}

          {timed.map((e) => {
            const startMin = parseClockTime(e.time!) ?? 0;
            const endMin = e.endTime ? parseClockTime(e.endTime) : null;
            const durationMin = endMin !== null && endMin > startMin ? endMin - startMin : 30;
            const top = (startMin / 30) * ROW_HEIGHT;
            const height = Math.max((durationMin / 30) * ROW_HEIGHT, ROW_HEIGHT * 0.5);
            const people = family.filter((m) => e.personIds.includes(m.id));
            const color = people[0]?.color ?? theme.colors.cal;
            return (
              <Pressable
                key={e.id}
                onPress={() => onSelectEvent(e)}
                style={{
                  position: 'absolute',
                  top,
                  height,
                  left: AGENDA_GUTTER + 6,
                  right: 8,
                  borderRadius: 8,
                  padding: 6,
                  backgroundColor: color + '30',
                  borderLeftWidth: 3,
                  borderLeftColor: color,
                  overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {people.length > 1 &&
                    people.slice(0, 4).map((p) => <View key={p.id} style={[styles.chipDot, { backgroundColor: p.color }]} />)}
                  <Text numberOfLines={height < ROW_HEIGHT ? 1 : 3} style={{ fontSize: 11.5, fontFamily: theme.fonts.bodyBold, color: theme.colors.ink, flexShrink: 1 }}>
                    {e.time}
                    {e.endTime ? `–${e.endTime}` : ''} {e.title}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {isToday && <NowLine color={theme.colors.danger} />}
        </View>
      </View>
    </ScrollView>
  );
}

/** A thin horizontal line marking the current time, only ever shown when
 * viewing today. Updates once a minute — no need for anything finer on a
 * wall display. */
function NowLine({ color }: { color: string }) {
  const [minutes, setMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  React.useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);
  const top = (minutes / 30) * ROW_HEIGHT;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: AGENDA_GUTTER, right: 0, height: 2, backgroundColor: color, borderRadius: 1 }} />
  );
}

function EventFormModal({
  mode,
  visible,
  date,
  initial,
  defaultTime,
  onClose,
  onSave,
  onDelete,
}: {
  mode: 'add' | 'edit';
  visible: boolean;
  date: string;
  initial: CalendarEvent | undefined;
  /** Only used in "add" mode — pre-fills the start time when the modal was
   * opened by tapping an empty slot in the Day agenda view. */
  defaultTime: string | undefined;
  onClose: () => void;
  onSave: (patch: { title: string; time: string; endTime: string; personIds: string[] }) => void;
  onDelete: (() => void) | undefined;
}) {
  const theme = useTheme();
  const family = useFamilyStore((s) => s.members);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [personIds, setPersonIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setTime(initial?.time ?? defaultTime ?? '');
      setEndTime(initial?.endTime ?? '');
      setPersonIds(initial?.personIds ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 4 }}>
            {mode === 'edit' ? 'Edit Event' : 'Add Event'}
          </Text>
          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 12, color: theme.colors.inkSoft, marginBottom: 14 }}>
            {date}
          </Text>

          <TextInput
            placeholder="Event title"
            placeholderTextColor={theme.colors.inkSoft}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Start time, e.g. 3:30 PM"
              placeholderTextColor={theme.colors.inkSoft}
              value={time}
              onChangeText={setTime}
              style={[styles.input, { flex: 1, backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
            />
            <TextInput
              placeholder="End time, e.g. 4:30 PM"
              placeholderTextColor={theme.colors.inkSoft}
              value={endTime}
              onChangeText={setEndTime}
              style={[styles.input, { flex: 1, backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
            />
          </View>
          <Text style={{ fontSize: 10.5, color: theme.colors.inkSoft, fontFamily: theme.fonts.body, marginBottom: 8, marginTop: -2 }}>
            Both optional — leave blank for an all-day event. Fill in both to set how long it runs.
          </Text>

          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 10.5, color: theme.colors.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Who's involved (tap to select any number)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {family.map((m) => {
              const active = personIds.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() =>
                    setPersonIds((prev) => (prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]))
                  }
                  style={[
                    styles.personChip,
                    { backgroundColor: active ? m.color : theme.colors.fieldBg },
                  ]}
                >
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: active ? '#fff' : theme.colors.ink }}>
                    {m.name}
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
              onPress={() => onSave({ title: title.trim(), time: time.trim(), endTime: endTime.trim(), personIds })}
              style={[styles.modalBtn, { backgroundColor: theme.colors.ink, opacity: title.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: '#fff' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Without an explicit flex here, the ScrollView has no bounded height on
  // web (react-native-web needs a flex child with minHeight:0 to know it's
  // allowed to scroll internally instead of just growing past the screen).
  scroll: { flex: 1, minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingBottom: 10, flexWrap: 'wrap' },
  monthTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffffffb0', alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  legendBox: { width: 15, height: 15, borderRadius: 5, borderWidth: 2, borderColor: '#00000022', alignItems: 'center', justifyContent: 'center' },
  filterHint: { fontSize: 11.5, paddingHorizontal: 24, marginBottom: 8 },
  gridWrap: { paddingHorizontal: 24, paddingBottom: 24 },
  gridCard: { borderRadius: 22, padding: 14 },
  dowRow: { flexDirection: 'row', marginBottom: 6 },
  dow: { flex: 1, textAlign: 'center', fontSize: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, borderRadius: 10, padding: 5, marginBottom: 0 },
  dayCellWeek: { aspectRatio: undefined, minHeight: 220 },
  chip: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, marginTop: 2 },
  chipDot: { width: 5, height: 5, borderRadius: 2.5 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 420, borderRadius: 24, padding: 22 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  personChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
  // Day agenda view
  agendaScroll: { flex: 1, minHeight: 0 },
  allDayRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingVertical: 10, borderBottomWidth: 1, alignItems: 'flex-start' },
  allDayLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, width: AGENDA_GUTTER, paddingTop: 4 },
  allDayChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  agendaRow: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  agendaTimeLabel: { fontSize: 10, width: AGENDA_GUTTER - 8, position: 'absolute', top: -7 },
});