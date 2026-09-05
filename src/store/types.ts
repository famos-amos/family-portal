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

export type BoardItem = {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  ownerId?: string | null;
  done: boolean;
};

export type CalendarEventSource = 'local' | 'google' | 'apple';

export type CalendarEvent = {
  id: string;
  /** ISO date, "YYYY-MM-DD" */
  date: string;
  time?: string;
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