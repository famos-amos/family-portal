import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { NARROW_BREAKPOINT } from '../../lib/layout';
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
import { isEventCalendarEnabled } from '../../lib/calendarVisibility';
import { eventCalendarColor } from '../../lib/calendarColors';
import { addDays, buildMonthGrid, buildWeekGrid, dayOfWeek, dayOfYear, formatWeekTitle, toIso, todayIso } from '../../lib/date';
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChoresIcon, MealIcon, QuestionIcon, StarIcon } from '../../components/icons';
import { Avatar } from '../../components/Avatar';
import { SegmentedControl } from '../../components/ui';
import { CalendarEvent, WidgetSize } from '../../store/types';
import { contrastText } from '../../lib/contrastColor';

const Row = ({ children }: { children: React.ReactNode }) => <View style={{ marginBottom: 10 }}>{children}</View>;

/** True on the grid/desktop dashboard layout (tablet, laptop, larger
 * displays) — as opposed to the single-column stacked mobile layout, which
 * keeps its own (smaller) sizing. See lib/layout.ts. */
function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= NARROW_BREAKPOINT;
}

function SectionTitle({
  icon,
  children,
  right,
  tint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Optional trailing content, pushed to the far right of the title row. */
  right?: React.ReactNode;
  /** This section's color (e.g. theme.colors.calBg) — the title row bleeds
   * out to the card's own edges (negative margin cancelling WidgetShell's
   * 16px card padding) and fills with this, so it reads as a shaded "table
   * header" bar across the top of an otherwise plain card, per the
   * reference design. WidgetShell's overflow:hidden clips the bleed to the
   * card's rounded corners. */
  tint: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: -16,
        marginTop: -16,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: tint,
      }}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontFamily: theme.fonts.head, color: theme.colors.ink, fontSize: 15, flexShrink: 1 }}>
        {children}
      </Text>
      {right != null && <View style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: 8 }}>{right}</View>}
    </View>
  );
}

// ---------------------------------------------------------------------------
export function CalendarWidgetContent({ size }: { size: WidgetSize }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const wide = useIsWide();
  const [view, setView] = useState<'week' | 'month'>('month');
  const [cursor, setCursor] = useState(new Date());
  const events = useCalendarStore((s) => s.events);
  const hidden = useSettingsStore((s) => s.hiddenPersonIds);
  const google = useSettingsStore((s) => s.google);
  const apple = useSettingsStore((s) => s.apple);
  const subscribedCalendars = useSettingsStore((s) => s.subscribedCalendars);
  const hiddenGoogleCalendarIds = useSettingsStore((s) => s.hiddenGoogleCalendarIds);
  const googleCalendarColors = useSettingsStore((s) => s.googleCalendarColors);
  const family = useFamilyStore((s) => s.members);

  const grid = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor.getFullYear(), cursor.getMonth()]);
  const calToggles = { google, apple, subscribedCalendars, hiddenGoogleCalendarIds };
  const visibleEvents = events.filter(
    (e) =>
      isEventCalendarEnabled(e, calToggles) &&
      (e.personIds.length === 0 || e.personIds.some((id) => !hidden.includes(id))),
  );
  const days = view === 'month' ? grid : buildWeekGrid(cursor);

  // Render the grid as one flex row per week (7 × flex:1 cells) rather than a
  // single flex-wrap container sized to an exact measured column width. A
  // measured width races the widget's own resize — at some tablet heights the
  // stale value was a hair too wide and Saturday wrapped under Sunday. With
  // per-week rows and no flexWrap, the 7th column can never wrap.
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const dotColor = (e: CalendarEvent) =>
    family.find((m) => m.id === e.personIds[0])?.color ??
    eventCalendarColor(e, google.calendars, googleCalendarColors) ??
    theme.colors.inkSoft;

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
    <View style={{ flex: 1, minHeight: 0 }}>
      <SectionTitle icon={<CalendarIcon size={wide ? 20 : 17} color={theme.colors.ink} />} tint={theme.colors.cal}>
        Calendar
      </SectionTitle>
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />
      <View style={styles.calTitleRow}>
        <Pressable
          onPress={() => navigate(-1)}
          style={[styles.calNavBtn, wide && styles.calNavBtnWide, { backgroundColor: theme.colors.fieldBg }]}
          hitSlop={6}
        >
          <ChevronLeftIcon size={wide ? 13 : 10} color={theme.colors.ink} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: theme.fonts.headSemiBold,
            color: theme.colors.ink,
            fontSize: wide ? 15 : 12.5,
            marginTop: 8,
            flex: 1,
            textAlign: 'center',
          }}
        >
          {titleText}
        </Text>
        <Pressable
          onPress={() => navigate(1)}
          style={[styles.calNavBtn, wide && styles.calNavBtnWide, { backgroundColor: theme.colors.fieldBg }]}
          hitSlop={6}
        >
          <ChevronRightIcon size={wide ? 13 : 10} color={theme.colors.ink} />
        </Pressable>
      </View>

      {view === 'month' ? (
        <>
          <View style={styles.dowRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text
                key={i}
                style={[
                  styles.dow,
                  { color: theme.colors.inkSoft, fontFamily: theme.fonts.headSemiBold },
                  wide && { fontSize: 12.5 },
                ]}
              >
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.calWeekRow}>
                {week.map(({ date, inMonth }, i) => {
                  const iso = toIso(date);
                  const isToday = iso === todayIso();
                  const dayEvents = visibleEvents.filter((e) => e.date === iso);
                  return (
                    <Pressable
                      key={i}
                      onPress={() => navigation.navigate('Calendar')}
                      style={[
                        styles.calCell,
                        // The card body is plain white (only the SectionTitle
                        // header strip is tinted now), so "today" needs an
                        // actual color to stand out and regular cells need a
                        // visible-on-white tint instead of a translucent
                        // white that used to pop against a colored card.
                        { backgroundColor: isToday ? theme.colors.calBg : theme.isDark ? '#FFFFFF0A' : theme.colors.fieldBg },
                        isToday && { borderWidth: 2, borderColor: theme.colors.cal },
                        !inMonth && { opacity: 0.35 },
                      ]}
                    >
                      <Text style={{ fontSize: wide ? 13 : 10.5, color: theme.colors.ink, fontFamily: theme.fonts.bodyBold }}>
                        {date.getDate()}
                      </Text>
                      {size !== 'sm' && (
                        <View style={styles.dotRow}>
                          {dayEvents.slice(0, 3).map((e) => (
                            <View
                              key={e.id}
                              style={[styles.dot, wide && styles.dotWide, { backgroundColor: dotColor(e) }]}
                            />
                          ))}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      ) : (
        // Week view: a scrollable agenda of what the week actually holds,
        // rather than the same small dotted day-cells — tap a day to jump
        // straight to it on the full Calendar screen.
        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false}>
          {days.map(({ date }) => {
            const iso = toIso(date);
            const isToday = iso === todayIso();
            const dayEvents = visibleEvents
              .filter((e) => e.date === iso)
              .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
            const visibleCount = wide ? 5 : 3;
            return (
              <Pressable
                key={iso}
                onPress={() => navigation.navigate('Calendar', { view: 'day', date: iso, ts: Date.now() })}
                style={[
                  styles.weekAgendaRow,
                  { backgroundColor: isToday ? theme.colors.calBg : theme.isDark ? '#FFFFFF0A' : theme.colors.fieldBg },
                  isToday && { borderWidth: 2, borderColor: theme.colors.cal },
                ]}
              >
                <View style={styles.weekAgendaDateCol}>
                  <Text style={{ fontSize: wide ? 11 : 9.5, fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={{ fontSize: wide ? 17 : 14, fontFamily: theme.fonts.head, color: theme.colors.ink }}>
                    {date.getDate()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  {dayEvents.length === 0 ? (
                    <Text style={{ fontSize: wide ? 12 : 10.5, fontFamily: theme.fonts.body, color: theme.colors.inkSoft }}>
                      No events
                    </Text>
                  ) : (
                    dayEvents.slice(0, visibleCount).map((e) => (
                      <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <View style={[styles.dot, wide && styles.dotWide, { backgroundColor: dotColor(e) }]} />
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            fontSize: wide ? 12.5 : 10.5,
                            fontFamily: theme.fonts.bodyBold,
                            color: theme.colors.ink,
                          }}
                        >
                          {e.time ? `${e.time} ` : ''}
                          {e.title}
                        </Text>
                      </View>
                    ))
                  )}
                  {dayEvents.length > visibleCount && (
                    <Text style={{ fontSize: 10, fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }}>
                      +{dayEvents.length - visibleCount} more
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {view === 'month' && size === 'lg' && (
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
  const navigation = useNavigation<any>();
  const events = useCalendarStore((s) => s.events);
  const hidden = useSettingsStore((s) => s.hiddenPersonIds);
  const google = useSettingsStore((s) => s.google);
  const apple = useSettingsStore((s) => s.apple);
  const subscribedCalendars = useSettingsStore((s) => s.subscribedCalendars);
  const hiddenGoogleCalendarIds = useSettingsStore((s) => s.hiddenGoogleCalendarIds);
  const googleCalendarColors = useSettingsStore((s) => s.googleCalendarColors);
  const family = useFamilyStore((s) => s.members);
  const today = todayIso();
  const openTodayInCalendar = () =>
    navigation.navigate('Calendar', { view: 'day', date: today, ts: Date.now() });
  const calToggles = { google, apple, subscribedCalendars, hiddenGoogleCalendarIds };
  const todays = events
    .filter(
      (e) =>
        e.date === today &&
        isEventCalendarEnabled(e, calToggles) &&
        (e.personIds.length === 0 || e.personIds.some((id) => !hidden.includes(id))),
    )
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const eventPeople = (ids: string[]) => family.filter((m) => ids.includes(m.id));

  return (
    <Pressable onPress={openTodayInCalendar} style={{ flex: 1, minHeight: 0 }}>
      <SectionTitle
        icon={<CalendarIcon size={17} color={theme.colors.ink} />}
        tint={theme.colors.cal}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.countBadge, { backgroundColor: theme.colors.calDk + '26' }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 11.5, color: theme.colors.calDk }}>
                {todays.length}
              </Text>
            </View>
            <View style={[styles.eventsArrowBtn, { backgroundColor: theme.isDark ? '#FFFFFF1A' : '#FFFFFFB0' }]}>
              <ChevronRightIcon size={12} color={theme.colors.calDk} />
            </View>
          </View>
        }
      >
        Today's Events
      </SectionTitle>
      {todays.length === 0 && (
        <Text style={{ color: theme.colors.inkSoft, fontFamily: theme.fonts.body, fontSize: 13 }}>
          Nothing on the calendar today.
        </Text>
      )}
      {/* Shows every event today, not just the first couple — scrolls
          internally (like the other dashboard cards) rather than cutting
          the list short when there are more than fit in the card. */}
      <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false}>
        {todays.map((e) => {
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
                    style={[
                      styles.eventDot,
                      {
                        backgroundColor:
                          p?.color ?? eventCalendarColor(e, google.calendars, googleCalendarColors) ?? theme.colors.inkSoft,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.ink, flex: 1 }}>
                {e.title}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Simplified to 3 fixed lines — yesterday, tonight, tomorrow — rather than a
// hero card plus a variable-length upcoming list. Tonight is the one that
// matters at a glance, so it's the only line with real emphasis (larger
// type, its own highlighted row); yesterday/tomorrow are deliberately quiet
// (small, no box around them) since they're just context.
export function MealWidgetContent() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const meals = useMealsStore((s) => s.meals);
  const family = useFamilyStore((s) => s.members);
  const today = dayOfWeek();

  const order: (typeof today)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const todayIdx = order.indexOf(today);
  const yesterday = order[(todayIdx + 6) % 7];
  const tomorrow = order[(todayIdx + 1) % 7];
  const mealFor = (d: typeof today) => meals.find((m) => m.day === d && m.slot === 'dinner');
  const dayLabel = (d: typeof today) => d[0].toUpperCase() + d.slice(1);

  const dinner = mealFor(today);
  const chefs = dinner ? family.filter((f) => dinner.chefIds.includes(f.id)) : [];
  const yesterdayMeal = mealFor(yesterday);
  const tomorrowMeal = mealFor(tomorrow);

  return (
    <Pressable onPress={() => navigation.navigate('MealPlans')} style={{ flex: 1 }}>
      <SectionTitle icon={<MealIcon size={17} color={theme.colors.ink} />} tint={theme.colors.meal}>
        Meal Plan
      </SectionTitle>
      <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
        <View style={styles.mealQuietRow}>
          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.inkSoft }}>
            {dayLabel(yesterday)}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 11, color: theme.colors.inkSoft, flexShrink: 1 }}
          >
            {yesterdayMeal?.name ?? '—'}
          </Text>
        </View>

        <View style={[styles.mealHero, { backgroundColor: theme.colors.mealBg }]}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 11, color: theme.colors.mealDk, marginBottom: 2 }}>
            Tonight
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: theme.fonts.head, fontSize: 16, color: theme.colors.ink }}>
            {dinner?.name ?? 'Nothing planned yet'}
          </Text>
          {chefs.length > 0 && (
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.inkSoft, marginTop: 3 }}>
              Chef{chefs.length > 1 ? 's' : ''}: {chefs.map((c) => c.name).join(', ')}
            </Text>
          )}
          {!!dinner?.rating && (
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 5 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon key={i} size={13} color={theme.colors.star} filled={i < (dinner.rating ?? 0)} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.mealQuietRow}>
          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.inkSoft }}>
            {dayLabel(tomorrow)}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 11, color: theme.colors.inkSoft, flexShrink: 1 }}
          >
            {tomorrowMeal?.name ?? '—'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Scrolls internally rather than showing only the first few items behind a
// resize/"show more" control — the widget's card stays a fixed size and you
// scroll the list within it.
export function TodoWidgetContent() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const allItems = useBoardsStore((s) => s.items);
  const toggle = useBoardsStore((s) => s.toggleItem);
  const items = allItems.filter((i) => i.columnId === 'todo');
  const leftCount = items.filter((i) => !i.done).length;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <Pressable onPress={() => navigation.navigate('Boards')}>
        <SectionTitle
          icon={<ChoresIcon size={17} color={theme.colors.ink} />}
          tint={theme.colors.boards}
          right={
            <View style={[styles.countBadge, { backgroundColor: theme.colors.boardsDk + '26' }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 11.5, color: theme.colors.boardsDk }}>
                {leftCount} left
              </Text>
            </View>
          }
        >
          To Do
        </SectionTitle>
      </Pressable>
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
  const family = useFamilyStore((s) => s.members);
  const votesDate = useDailyStore((s) => s.votesDate);
  const rawVotes = useDailyStore((s) => s.votes);
  const castVote = useDailyStore((s) => s.castVote);

  const idx = dayOfYear() % dailyChallenges.length;
  const challenge = dailyChallenges[idx];
  const today = todayIso();
  const isVote = !!(challenge.optionA && challenge.optionB);

  // Only today's votes count — a stale tally left over from a previous
  // "Would You Rather" day is ignored here, and gets wiped by castVote the
  // moment someone votes today.
  const votes = votesDate === today ? rawVotes : {};

  // Which family member is currently at the tablet. Cleared after each fresh
  // vote so the next person can't overwrite the last one by accident.
  const [voterId, setVoterId] = useState<string | null>(null);
  const voter = family.find((m) => m.id === voterId) ?? null;

  const votersFor = (key: 'A' | 'B') => family.filter((m) => votes[m.id] === key);

  const onOption = (key: 'A' | 'B') => {
    if (!voter) return;
    const had = votes[voter.id];
    castVote(today, voter.id, key);
    if (had !== key) setVoterId(null); // a fresh vote (or a change) — retract keeps you selected
  };

  // The "who's voting" picker — compact avatar strip that sits in the widget
  // header (top-right) rather than eating a full row below the options.
  const voterPicker = isVote ? (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {family.map((m) => {
        const selected = m.id === voterId;
        const voted = !!votes[m.id];
        return (
          <Pressable key={m.id} onPress={() => setVoterId(selected ? null : m.id)} hitSlop={4}>
            <View style={{ opacity: !voterId || selected ? 1 : 0.4 }}>
              <Avatar
                initials={m.initials}
                color={m.color}
                size={24}
                style={selected ? { borderColor: theme.colors.boardsDk } : undefined}
              />
              {voted && (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: theme.colors.boardsDk,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon size={8} color={contrastText(theme.colors.boardsDk)} />
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  ) : undefined;

  return (
    <View>
      <SectionTitle
        icon={<QuestionIcon size={17} color={theme.colors.ink} />}
        tint={theme.colors.boards}
        right={voterPicker}
      >
        Daily Challenge
      </SectionTitle>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 11,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: theme.colors.boardsBg,
          marginBottom: 6,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 10.5, color: theme.colors.boardsDk }}>
          {challenge.tag}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={1.2}
        style={{ fontFamily: theme.fonts.bodyBold, fontSize: 12, lineHeight: 16, color: theme.colors.ink, marginBottom: 8 }}
      >
        {challenge.question}
      </Text>
      {isVote && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[challenge.optionA, challenge.optionB].map((opt, i) => {
              const key = i === 0 ? ('A' as const) : ('B' as const);
              const optVoters = votersFor(key);
              const picked = voter ? votes[voter.id] === key : false;
              return (
                <Pressable
                  key={opt}
                  onPress={() => onOption(key)}
                  style={[
                    styles.optBtn,
                    { backgroundColor: theme.colors.boardsBg },
                    picked && { borderColor: theme.colors.boardsDk, borderWidth: 2 },
                    !voter && { opacity: 0.55 },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={1.1}
                    style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 10.5, color: theme.colors.ink, textAlign: 'center' }}
                  >
                    {opt}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, minHeight: 7 }}>
                    <Text
                      maxFontSizeMultiplier={1.1}
                      style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 9.5, color: theme.colors.inkSoft }}
                    >
                      {optVoters.length}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {optVoters.slice(0, 5).map((p) => (
                        <View key={p.id} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: p.color }} />
                      ))}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: 10,
              color: theme.colors.inkSoft,
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            {voter ? `Voting as ${voter.name}` : 'Tap your initials above to vote'}
          </Text>
        </>
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
      <SectionTitle icon={<Text style={{ fontSize: 16 }}>📖</Text>} tint={theme.colors.verse}>
        Verse of the Day
      </SectionTitle>
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
// A circular progress ring: a faint full-circle track with a coloured arc
// drawn on top that sweeps clockwise from 12 o'clock in proportion to
// `progress` (0-1). `children` are centred inside (used for the "2/3" label).
function ProgressRing({
  size,
  stroke,
  progress,
  color,
  trackColor,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  trackColor: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ring size now actually responds to the resize control (the corner handle
// WidgetShell shows for any widget passed a `size`) — it used to ignore
// `size` entirely and always render the same fixed ring, so cycling
// sm/md/lg visibly did nothing.
const CHORES_RING_SIZES: Record<WidgetSize, { wide: number; narrow: number }> = {
  sm: { wide: 56, narrow: 44 },
  md: { wide: 72, narrow: 54 },
  lg: { wide: 90, narrow: 66 },
};
const CHORES_RING_STROKES: Record<WidgetSize, { wide: number; narrow: number }> = {
  sm: { wide: 7, narrow: 5 },
  md: { wide: 8, narrow: 6 },
  lg: { wide: 10, narrow: 7 },
};

export function ChoresWidgetContent({ size }: { size: WidgetSize }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const wide = useIsWide();
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

  // Bigger rings + type on the wide/desktop dashboard than the stacked
  // mobile layout — but not so big they outgrow the card's actual height
  // (this row is the shortest of the 3 dashboard rows). 92px rings used to
  // spill past the card's bottom edge once name + stars text were added
  // above/below them.
  const ringSize = wide ? CHORES_RING_SIZES[size].wide : CHORES_RING_SIZES[size].narrow;
  const ringStroke = wide ? CHORES_RING_STROKES[size].wide : CHORES_RING_STROKES[size].narrow;

  const totalDone = withChores.reduce((sum, x) => sum + x.done, 0);
  const totalAll = withChores.reduce((sum, x) => sum + x.total, 0);
  const weekProgress = wide ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={[styles.weekTrack, { backgroundColor: theme.isDark ? '#FFFFFF20' : '#00000014' }]}>
        <View
          style={[
            styles.weekTrackFill,
            { width: `${totalAll ? (totalDone / totalAll) * 100 : 0}%`, backgroundColor: theme.colors.accent },
          ]}
        />
        <View
          style={[
            styles.weekTrackThumb,
            {
              left: `${totalAll ? (totalDone / totalAll) * 100 : 0}%`,
              backgroundColor: theme.colors.accent,
              borderColor: theme.colors.panel,
            },
          ]}
        />
      </View>
      <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.inkSoft }}>
        {totalDone}/{totalAll}
      </Text>
    </View>
  ) : undefined;

  return (
    <Pressable onPress={() => navigation.navigate('Chores')} style={{ flex: 1 }}>
      <SectionTitle
        icon={<ChoresIcon size={wide ? 20 : 17} color={theme.colors.ink} />}
        tint={theme.colors.choresWeekBg}
        right={weekProgress}
      >
        Chores
      </SectionTitle>
      <View style={{ flexDirection: 'row', gap: wide ? 18 : 14 }}>
        {withChores.map(({ member, total, done, stars }) => (
          <View key={member.id} style={{ flex: 1, alignItems: 'center', gap: wide ? 5 : 4 }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: wide ? 16 : 13, color: member.color }}>
              {member.name}
            </Text>
            <ProgressRing
              size={ringSize}
              stroke={ringStroke}
              progress={total ? done / total : 0}
              trackColor={theme.isDark ? '#FFFFFF20' : theme.colors.fieldBg}
              color={member.color}
            >
              <Text style={{ fontFamily: theme.fonts.head, fontSize: wide ? 16 : 12, color: theme.colors.ink }}>
                {done}/{total}
              </Text>
            </ProgressRing>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <StarIcon size={wide ? 13 : 11} color={theme.colors.star} />
              <Text style={{ fontSize: wide ? 12.5 : 10.5, fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }}>
                {stars} stars earned
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  eventsArrowBtn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  // Aggregate "this week" progress indicator in the Chores card header — a
  // styled track, not an actual draggable control (there's nothing to drag
  // to; it's a read-only visualization of totalDone/totalAll).
  weekTrack: { width: 120, height: 6, borderRadius: 3, justifyContent: 'center' },
  weekTrackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  weekTrackThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginLeft: -7,
  },
  calTitleRow: { marginBottom: 2, flexDirection: 'row', alignItems: 'center' },
  calNavBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffffb0', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  calNavBtnWide: { width: 24, height: 24, borderRadius: 12 },
  dowRow: { flexDirection: 'row', marginTop: 8 },
  dow: { flex: 1, textAlign: 'center', fontSize: 10 },
  calGrid: {},
  calWeekRow: { flexDirection: 'row' },
  calCell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: 8,
  },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4.5, height: 4.5, borderRadius: 2.5 },
  dotWide: { width: 6, height: 6, borderRadius: 3 },
  weekAgendaRow: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  weekAgendaDateCol: { width: 38, alignItems: 'center' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#00000018', borderStyle: 'dashed' },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1 },
  eventDot: { width: 9, height: 9, borderRadius: 4.5 },
  mealHero: { borderRadius: 16, padding: 12 },
  // The quiet yesterday/tomorrow lines — no box, no border, just a dimmer
  // row so "Tonight" above is the only thing that reads as emphasized.
  mealQuietRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  todoBox: { width: 17, height: 17, borderRadius: 6, borderWidth: 2 },
  optBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
});