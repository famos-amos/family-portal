// Shared "what Gemini is allowed to see" builder for every Huddle AI feature
// (voice — huddleVoice.ts, and flyer photos — huddleSnap.ts): just enough
// live household data for Gemini to quote EXACT existing names back, so the
// client can match actions to real records instead of guessing.
import { useChoresStore, useFamilyStore, useMealsStore } from '../store/useAppStore';
import { todayIso, dayOfWeek } from './date';

export type HuddleContext = {
  todayIso: string;
  dayOfWeek: string;
  familyNames: string[];
  openChoreTitles: string[];
  plannedMeals: { day: string; slot: string; name: string }[];
};

export function buildHuddleContext(): HuddleContext {
  const openChoreTitles = useChoresStore
    .getState()
    .chores.filter((c) => !c.done)
    .map((c) => c.title);
  const familyNames = useFamilyStore.getState().members.map((m) => m.name);
  const plannedMeals = useMealsStore
    .getState()
    .meals.filter((m) => m.slot === 'dinner')
    .map((m) => ({ day: m.day, slot: m.slot, name: m.name }));
  return { todayIso: todayIso(), dayOfWeek: dayOfWeek(), familyNames, openChoreTitles, plannedMeals };
}
