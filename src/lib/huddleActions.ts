// The structured actions Gemini extracts from a Huddle voice clip (see
// supabase/functions/huddle-voice), and how each one gets applied to the
// app's real data once the family member reviewing them taps Confirm.
import { useBoardsStore, useChoresStore, useCalendarStore, useMealsStore } from '../store/useAppStore';
import { DayOfWeek, MealSlotType } from '../store/types';

export type VoiceAction =
  | { type: 'calendar_event'; title: string; date: string; time?: string | null; endTime?: string | null }
  | { type: 'reminder'; title: string; date?: string | null; time?: string | null }
  | { type: 'chore_complete'; choreTitle: string }
  | { type: 'shopping_item'; title: string }
  | { type: 'meal_plan'; day: DayOfWeek; slot: MealSlotType; name: string };

/** One action, plus everything the review card needs: a human summary, any
 * match already resolved against live data, and whether it's safe to apply. */
export type ReviewableAction = {
  id: string;
  action: VoiceAction;
  summary: string;
  /** Resolved chore id for a chore_complete action — undefined if no
   * confident match was found among the household's open chores. */
  matchedChoreId?: string;
  canApply: boolean;
  /** Shown under the summary when canApply is false, or just as a heads-up. */
  note?: string;
};

function formatWhen(date?: string | null, time?: string | null): string {
  const parts: string[] = [];
  if (date) {
    const d = new Date(`${date}T12:00:00`);
    parts.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  }
  if (time) parts.push(time);
  return parts.join(' · ');
}

const DAY_LABEL: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Turns Gemini's raw actions into review-ready cards, resolving chore
 * titles against the household's actual open chores so the UI (and
 * applyVoiceAction) can act on a real id rather than free text. */
export function buildReviewableActions(actions: VoiceAction[]): ReviewableAction[] {
  const openChores = useChoresStore.getState().chores.filter((c) => !c.done);

  return actions.map((action, i) => {
    const id = `${Date.now()}-${i}`;
    switch (action.type) {
      case 'calendar_event':
        return {
          id,
          action,
          summary: `Add "${action.title}" to the calendar${formatWhen(action.date, action.time) ? ` — ${formatWhen(action.date, action.time)}` : ''}`,
          canApply: true,
        };
      case 'reminder':
        return {
          id,
          action,
          summary: `Remind: "${action.title}"${formatWhen(action.date, action.time) ? ` — ${formatWhen(action.date, action.time)}` : ''}`,
          canApply: true,
        };
      case 'shopping_item':
        return { id, action, summary: `Add "${action.title}" to the shopping list`, canApply: true };
      case 'meal_plan':
        return {
          id,
          action,
          summary: `Set ${DAY_LABEL[action.day]} ${action.slot} to "${action.name}"`,
          canApply: true,
        };
      case 'chore_complete': {
        const lower = action.choreTitle.trim().toLowerCase();
        const exact = openChores.find((c) => c.title.toLowerCase() === lower);
        const contains = exact ?? openChores.find((c) => c.title.toLowerCase().includes(lower) || lower.includes(c.title.toLowerCase()));
        return {
          id,
          action,
          summary: `Mark chore "${contains?.title ?? action.choreTitle}" as done`,
          matchedChoreId: contains?.id,
          canApply: !!contains,
          note: contains ? undefined : "Couldn't match this to an open chore — mark it done manually instead.",
        };
      }
    }
  });
}

/** Commits one reviewed action to the real stores. Call only for actions the
 * family member actually tapped Confirm on. */
export function applyVoiceAction(reviewable: ReviewableAction): void {
  const { action } = reviewable;
  switch (action.type) {
    case 'calendar_event':
      useCalendarStore.getState().addEvent({
        date: action.date,
        title: action.title,
        time: action.time ?? undefined,
        endTime: action.endTime ?? undefined,
        personIds: [],
      });
      return;
    case 'reminder':
      useBoardsStore.getState().addItem({
        columnId: 'todo',
        title: action.title,
        description: formatWhen(action.date, action.time) || undefined,
      });
      return;
    case 'shopping_item':
      useBoardsStore.getState().addItem({ columnId: 'shopping', title: action.title });
      return;
    case 'chore_complete':
      if (reviewable.matchedChoreId) useChoresStore.getState().toggleChore(reviewable.matchedChoreId);
      return;
    case 'meal_plan': {
      const existing = useMealsStore
        .getState()
        .meals.find((m) => m.day === action.day && m.slot === action.slot);
      useMealsStore.getState().upsertMeal({
        id: existing?.id,
        day: action.day,
        slot: action.slot,
        name: action.name,
        chefIds: existing?.chefIds ?? [],
        notes: existing?.notes,
        rating: existing?.rating,
      });
      return;
    }
  }
}
