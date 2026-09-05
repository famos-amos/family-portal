import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  useBoardsStore,
  useCalendarStore,
  useChoresStore,
  useDailyStore,
  useFamilyStore,
  useMealsStore,
  useSettingsStore,
  useVerseStore,
} from '../../store/useAppStore';
import { dailyChallenges, verses } from '../../data/seed';
import { addDays, buildMonthGrid, buildWeekGrid, dayOfWeek, dayOfYear, formatWeekTitle, todayIso } from '../../lib/date';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ChoresIcon, MealIcon, QuestionIcon, StarIcon } from '../../components/icons';
import { SegmentedControl } from '../../components/ui';
import { WidgetSize } from '../../store/types';

const Row = ({ children }: { children: React.ReactNode }) => <View style={{ marginBottom: 10 }}>{children}</View>;

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      {icon}
      <Text style={{ fontFamily: theme.fonts.head, color: theme.colors.ink, fontSize: 15 }}>{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
export function CalendarWidgetContent({ size }: { size: WidgetSize }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [view, setView] = useState<'week' | 'month'>('month');
  const [cursor, setCursor] = useState(new Date());
  const events = useCalendarStore((s) => s.events);
  const hidden = useSettingsStore((s) => s.hiddenPersonIds);
  const family = useFamilyStore((s) => s.members);

  const grid = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor.getFullYear(), cursor.getMonth()]);
  const visibleEvents = events.filter((e) => e.personIds.length === 0 || e.personIds.some((id) => !hidden.includes(id)));
  const days = view === 'month' ? grid : buildWeekGrid(cursor);

  const personColor = (ids: string[]) => family.find((m) => m.id === ids[0])?.color ?? theme.colors.inkSoft;

  // Prev/Next mean "a month" or "a week" depending on which sub-view is
  // active — mirrors the same browsable-cursor pattern used on the full
  // Calendar screen, just compacted to fit this narrow widget column.
  const navigate = (delta: number) => {
    setCursor(view === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1) : addDays(cursor, delta * 7));
  };
  const titleText = view === 'month'
    ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : formatWeekTitle(cursor);

  return (
    <View>
      <SectionTitle icon={<CalendarIcon size={17} color={theme.colors.ink} />}>Calendar</SectionTitle>
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />
      <View style={styles.calTitleRow}>
        <Pressable onPress={() => navigate(-1)} style={styles.calNavBtn} hitSlop={6}>
          <ChevronLeftIcon size={10} color={theme.colors.ink} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.ink, fontSize: 12.5, marginTop: 8, flex: 1, textAlign: 'center' }}
        >
          {titleText}
        </Text>
        <Pressable onPress={() => navigate(1)} style={styles.calNavBtn} hitSlop={6}>
          <ChevronRightIcon size={10} color={theme.colors.ink} />
        </Pressable>
      </View>
      <View style={styles.dowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={[styles.dow, { color: theme.colors.inkSoft, fontFamily: theme.fonts.headSemiBold }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {days.map(({ date, inMonth }, i) => {
          const iso = date.toISOString().slice(0, 10);
          const isToday = iso === todayIso();
          const dayEvents = visibleEvents.filter((e) => e.date === iso);
          return (
            <Pressable
              key={i}
              onPress={() => navigation.navigate('Calendar')}
              style={[
                styles.calCell,
                { backgroundColor: isToday ? theme.colors.panel : theme.isDark ? '#FFFFFF0A' : '#FFFFFFA8' },
                isToday && { borderWidth: 2, borderColor: theme.colors.cal },
                !inMonth && { opacity: 0.35 },
              ]}
            >
              <Text style={{ fontSize: 10.5, color: theme.colors.ink, fontFamily: theme.fonts.bodyBold }}>
                {date.getDate()}
              </Text>
              {size !== 'sm' && (
                <View style={styles.dotRow}>
                  {dayEvents.slice(0, 3).map((e) => (
                    <View key={e.id} style={[styles.dot, { backgroundColor: personColor(e.personIds) }]} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {size === 'lg' && (
        <View style={styles.legendRow}>
          {family.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[styles.legendDot, { backgroundColor: m.color }]} />
              <Text style={{ fontSize: 11, fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }}>
                {m.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
export function EventsWidgetContent({ size }: { size: WidgetSize }) {
  const theme = useTheme();
  const events = useCalendarStore((s) => s.events);
  const hidden = useSettingsStore((s) => s.hiddenPersonIds);
  const family = useFamilyStore((s) => s.members);
  const today = todayIso();
  const todays = events
    .filter((e) => e.date === today && (e.personIds.length === 0 || e.personIds.some((id) => !hidden.includes(id))))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const eventPeople = (ids: string[]) => family.filter((m) => ids.includes(m.id));
  const list = size === 'sm' ? todays.slice(0, 2) : todays;

  return (
    <View>
      <SectionTitle icon={<CalendarIcon size={17} color={theme.colors.ink} />}>Today's Events</SectionTitle>
      {list.length === 0 && (
        <Text style={{ color: theme.colors.inkSoft, fontFamily: theme.fonts.body, fontSize: 13 }}>
          Nothing on the calendar today.
        </Text>
      )}
      {list.map((e) => {
        const people = eventPeople(e.personIds);
        return (
          <View key={e.id} style={[styles.eventRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={{ width: 64, fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.inkSoft }}>
              {e.time ?? 'All day'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {(people.length ? people : [null]).slice(0, 3).map((p, i) => (
                <View
                  key={p?.id ?? i}
                  style={[styles.eventDot, { backgroundColor: p?.color ?? theme.colors.inkSoft }]}
                />
              ))}
            </View>
            <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.ink, flex: 1 }}>
              {e.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
export function MealWidgetContent({ size }: { size: WidgetSize }) {
  const theme = useTheme();
  const meals = useMealsStore((s) => s.meals);
  const family = useFamilyStore((s) => s.members);
  const today = dayOfWeek();
  const dinner = meals.find((m) => m.day === today && m.slot === 'dinner');
  const chefs = dinner ? family.filter((f) => dinner.chefIds.includes(f.id)) : [];

  const order: (typeof today)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const todayIdx = order.indexOf(today);
  const upcoming = [1, 2]
    .map((offset) => order[(todayIdx + offset) % 7])
    .map((d) => ({ day: d, meal: meals.find((m) => m.day === d && m.slot === 'dinner') }))
    .filter((x) => x.meal);

  return (
    <View>
      <SectionTitle icon={<MealIcon size={17} color={theme.colors.ink} />}>Meal Plan</SectionTitle>
      <View style={[styles.mealHero, { backgroundColor: theme.isDark ? '#FFFFFF10' : '#FFFFFFA0' }]}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.colors.ink, marginBottom: 3 }}>
          {dinner?.name ?? 'No dinner planned yet'}
        </Text>
        {chefs.length > 0 && (
          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.inkSoft, marginBottom: 8 }}>
            Chef{chefs.length > 1 ? 's' : ''}: {chefs.map((c) => c.name).join(', ')} • Dinner
          </Text>
        )}
        {!!dinner?.rating && (
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <StarIcon key={i} size={15} color={theme.colors.star} filled={i < (dinner.rating ?? 0)} />
            ))}
          </View>
        )}
      </View>
      {size !== 'sm' &&
        upcoming.map(({ day, meal }) => (
          <View key={day} style={[styles.mealRow, { borderTopColor: theme.colors.border }]}>
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.inkSoft }}>
              {day === order[(todayIdx + 1) % 7] ? 'Tomorrow' : day[0].toUpperCase() + day.slice(1)}
            </Text>
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.inkSoft }}>
              {meal?.name}
            </Text>
          </View>
        ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scrolls internally rather than showing only the first few items behind a
// resize/"show more" control — the widget's card stays a fixed size and you
// scroll the list within it.
export function TodoWidgetContent() {
  const theme = useTheme();
  const allItems = useBoardsStore((s) => s.items);
  const toggle = useBoardsStore((s) => s.toggleItem);
  const items = allItems.filter((i) => i.columnId === 'todo');

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <SectionTitle icon={<ChoresIcon size={17} color={theme.colors.ink} />}>To Do</SectionTitle>
      <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <Pressable key={item.id} onPress={() => toggle(item.id)} style={styles.todoRow}>
            <View
              style={[
                styles.todoBox,
                { borderColor: theme.colors.boardsDk, backgroundColor: item.done ? theme.colors.boardsDk : 'transparent' },
              ]}
            />
            <Text
              style={{
                fontFamily: theme.fonts.bodySemiBold,
                fontSize: 13.5,
                color: theme.colors.ink,
                textDecorationLine: item.done ? 'line-through' : 'none',
                opacity: item.done ? 0.55 : 1,
              }}
            >
              {item.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
export function ChallengeWidgetContent() {
  const theme = useTheme();
  const { answeredDate, answer, setAnswer } = useDailyStore();
  const idx = dayOfYear() % dailyChallenges.length;
  const challenge = dailyChallenges[idx];
  const today = todayIso();
  const todaysAnswer = answeredDate === today ? answer : null;

  return (
    <View>
      <SectionTitle icon={<QuestionIcon size={17} color={theme.colors.ink} />}>Daily Challenge</SectionTitle>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 11,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: theme.isDark ? '#FFFFFF16' : '#FFFFFFB0',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 10.5, color: theme.colors.boardsDk }}>
          {challenge.tag}
        </Text>
      </View>
      <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.ink, marginBottom: 10 }}>
        {challenge.question}
      </Text>
      {challenge.optionA && challenge.optionB && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[challenge.optionA, challenge.optionB].map((opt, i) => {
            const key = i === 0 ? 'A' : 'B';
            const picked = todaysAnswer === key;
            return (
              <Pressable
                key={opt}
                onPress={() => setAnswer(today, key)}
                style={[
                  styles.optBtn,
                  { backgroundColor: theme.isDark ? '#FFFFFF16' : '#FFFFFFB0' },
                  picked && { borderColor: theme.colors.boardsDk, borderWidth: 2 },
                ]}
              >
                <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 11.5, color: theme.colors.ink }}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pulled from a real RSS feed (see src/lib/verseFeed.ts + useVerseStore) —
// falls back instantly to the app's small local verse rotation (by
// day-of-year, so it's still a different verse each day) while the fetch is
// in flight, or if it fails (offline, a CORS block in a web preview, etc.).
export function VerseWidgetContent() {
  const theme = useTheme();
  const rssText = useVerseStore((s) => s.text);
  const rssReference = useVerseStore((s) => s.reference);
  const fetchIfNeeded = useVerseStore((s) => s.fetchIfNeeded);

  React.useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const idx = dayOfYear() % verses.length;
  const fallback = verses[idx];
  const text = rssText ?? fallback.text;
  const reference = rssReference ?? fallback.ref;

  return (
    <View>
      <SectionTitle icon={<Text style={{ fontSize: 16 }}>📖</Text>}>Verse of the Day</SectionTitle>
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 30, color: '#B79FD6', lineHeight: 26 }}>"</Text>
      <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontStyle: 'italic', fontSize: 13, color: theme.colors.ink, lineHeight: 19 }}>
        {text}
      </Text>
      {!!reference && (
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: '#7A5AA6', marginTop: 8 }}>
          {reference}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
export function ChoresWidgetContent() {
  const theme = useTheme();
  const chores = useChoresStore((s) => s.chores);
  const family = useFamilyStore((s) => s.members);

  const withChores = family
    .map((m) => {
      const mine = chores.filter((c) => c.assigneeId === m.id);
      const done = mine.filter((c) => c.done);
      return {
        member: m,
        total: mine.length,
        done: done.length,
        stars: done.reduce((sum, c) => sum + c.points, 0),
      };
    })
    .filter((x) => x.total > 0);

  return (
    <View style={{ flexDirection: 'row', gap: 18 }}>
      {withChores.map(({ member, total, done, stars }) => (
        <View key={member.id} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: member.color }}>{member.name}</Text>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              borderWidth: 7,
              borderColor: theme.isDark ? '#FFFFFF20' : '#FFFFFFB0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                width: 60,
                height: 60,
                borderRadius: 30,
                borderWidth: 7,
                borderColor: member.color,
                opacity: total ? done / total : 0,
              }}
            />
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 12, color: theme.colors.ink }}>
              {done}/{total}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <StarIcon size={11} color={theme.colors.star} />
            <Text style={{ fontSize: 10.5, fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }}>
              {stars} stars earned
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  calTitleRow: { marginBottom: 2, flexDirection: 'row', alignItems: 'center' },
  calNavBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffffb0', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  dowRow: { flexDirection: 'row', marginTop: 8 },
  dow: { flex: 1, textAlign: 'center', fontSize: 10 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: 8,
  },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4.5, height: 4.5, borderRadius: 2.5 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#00000018', borderStyle: 'dashed' },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1 },
  eventDot: { width: 9, height: 9, borderRadius: 4.5 },
  mealHero: { borderRadius: 16, padding: 12 },
  mealRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, marginTop: 4 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  todoBox: { width: 17, height: 17, borderRadius: 6, borderWidth: 2 },
  optBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
});