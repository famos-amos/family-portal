import { DayOfWeek } from '../store/types';

const DOW: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayOfWeek(date: Date = new Date()): DayOfWeek {
  return DOW[date.getDay()];
}

export function dayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Sunday of the week containing `date`, at local midnight — the app's
 * calendar grids are Sunday-first throughout (see buildMonthGrid/DOW), so
 * "the week" always means Sunday..Saturday. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** "Week of <Sunday's date>" — the exact title format used for the week
 * view's browsable header, both on the Calendar screen and the Home
 * dashboard's Calendar widget. */
export function formatWeekTitle(date: Date): string {
  const sunday = startOfWeek(date);
  return `Week of ${sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
}

/** "Tuesday, August 25" — used as the Day agenda view's browsable header. */
export function formatDayTitle(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Mon-first weekday label used across the Meal Plans / Chores screens. */
export const WEEKDAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

/** Builds a 6-week (42-day) grid for the given month, Sunday-first. */
export function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = addDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    return { date: d, inMonth: d.getMonth() === month };
  });
}

/** Builds the 7-day (Sunday-first) grid for the week containing `date` —
 * used by the Week view on both the Calendar screen and the Home dashboard
 * widget so week browsing doesn't depend on which month grid happens to be
 * built, and keeps working correctly across a month boundary. */
export function buildWeekGrid(date: Date): { date: Date; inMonth: boolean }[] {
  const sunday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => ({ date: addDays(sunday, i), inMonth: true }));
}

/** Best-effort reader for the free-typed clock times used throughout the
 * app ("3:30 PM", "9 AM", "15:30", ...) — returns minutes since midnight, or
 * null if the text doesn't look like a time at all. Used by the Day agenda
 * view to position/size events; the event's own `time`/`endTime` fields
 * stay plain free text everywhere else, this is just a best-effort reader
 * of them. */
export function parseClockTime(input: string): number | null {
  const s = input.trim();
  let m = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (/[Pp]/.test(m[3])) h += 12;
    return h * 60 + parseInt(m[2], 10);
  }
  m = s.match(/^(\d{1,2})\s*([AaPp][Mm])$/);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (/[Pp]/.test(m[2])) h += 12;
    return h * 60;
  }
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (h >= 0 && h < 24 && mins >= 0 && mins < 60) return h * 60 + mins;
  }
  return null;
}

/** "9 AM", "9:30 AM" — the left-hand time-of-day label for half-hour slot
 * index `i` (0 = midnight, 1 = 12:30 AM, 2 = 1:00 AM, ...) in the Day
 * agenda view. */
export function formatHalfHourLabel(slotIndex: number): string {
  const totalMinutes = slotIndex * 30;
  const h24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mins === 0 ? `${h12} ${period}` : `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
}