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

/** One ingredient line on a Recipe — kept as a separate amount/name pair
 * (rather than one free-text string) so the Recipes screen can align
 * amounts in a column and so a future "add to grocery list" feature could
 * read amounts programmatically. */
export type Ingredient = {
  amount: string;
  name: string;
};

export type Recipe = {
  id: string;
  name: string;
  slot: MealSlotType;
  time: string;
  ingredients: Ingredient[];
  steps: string[];
};

/** A family-submitted meal idea for the weekly plan (the Suggestions
 * screen's "Meal ideas" list). Picking a day for it is optional — an idea
 * can just sit here with no day/slot at all, or be scheduled right away. */
export type MealSuggestion = {
  id: string;
  name: string;
  /** Zero or more family members credited with suggesting this idea. */
  suggestedByIds: string[];
  /** Set once/if this idea has been scheduled into the weekly plan (the day
   * + meal slot it was assigned to) — null/undefined while it's still just
   * an idea with no day picked yet. */
  day?: DayOfWeek | null;
  slot?: MealSlotType | null;
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