export type FamilyMember = {
  id: string;
  name: string;
  /** ISO date string, e.g. "2018-06-28". Month/day only is fine if year is unknown. */
  birthday?: string;
  color: string;
  /** 1-2 letter avatar initials, derived from name but editable. */
  initials: string;
};

export type Chore = {
  id: string;
  title: string;
  /** null = "Up for Grabs" (unclaimed) */
  assigneeId: string | null;
  points: number;
  done: boolean;
};

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type MealSlotType = 'breakfast' | 'lunch' | 'dinner';

export type Meal = {
  id: string;
  day: DayOfWeek;
  slot: MealSlotType;
  name: string;
  /** Zero or more family members cooking/responsible for this meal. */
  chefIds: string[];
  notes?: string;
  /** 0-5 stars, only really meaningful once the meal's been cooked & rated. */
  rating?: number;
};

export type BoardColumn = {
  id: string;
  title: string;
  color: string;
};

/** null/undefined = never auto-delete. 'immediately' deletes the item the
 * instant it's checked done (no lingering checked-off state); the other
 * three values are how long a checked-off item is kept before the app
 * sweeps it away automatically. */
export type BoardAutoDelete = 'immediately' | '72h' | 'month' | 'year';

export type BoardItem = {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  ownerId?: string | null;
  done: boolean;
  /** ISO timestamp of when this item was last marked done, or null/undefined
   * if it isn't done right now (or has never had an auto-delete rule). This
   * is what the auto-delete sweep measures elapsed time against. */
  doneAt?: string | null;
  autoDelete?: BoardAutoDelete | null;
};

export type CalendarEventSource = 'local' | 'google' | 'apple';

export type CalendarEvent = {
  id: string;
  /** ISO date, "YYYY-MM-DD" */
  date: string;
  time?: string;
  /** Optional end time, same free-text format as `time` (e.g. "4:30 PM").
   * Used to size/position the event block in the Calendar's Day agenda
   * view; purely informational everywhere else. */
  endTime?: string;
  title: string;
  /** Zero or more family members this event involves. */
  personIds: string[];
  source: CalendarEventSource;
};

export type ThemePreference = 'light' | 'dark' | 'system';

export type WidgetId =
  | 'calendar'
  | 'events'
  | 'meal'
  | 'todo'
  | 'challenge'
  | 'verse'
  | 'chores';

export type WidgetSize = 'sm' | 'md' | 'lg';