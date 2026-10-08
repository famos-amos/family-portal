// Tracks "has anything in Settings changed since the last Save tap" so
// SettingsScreen can show a Save button that only lights up when there's
// something new, with a confirmation once pressed.
//
// Every individual setting already writes through immediately (to
// AsyncStorage and, where relevant, Supabase) the moment you toggle it —
// there's no real "unsaved draft" state to lose. This Save button is a
// deliberate reassurance layer on top of that, not a gate blocking changes
// from taking effect; see watchForSettingsChanges() below for exactly which
// stores count as "a settings change" for its purposes.
import { create } from 'zustand';
import { useAppLockStore, useFamilyStore, useSettingsStore } from '../store/useAppStore';

type SettingsDirtyState = {
  dirty: boolean;
  markDirty: () => void;
  markSaved: () => void;
};

export const useSettingsDirtyStore = create<SettingsDirtyState>((set) => ({
  dirty: false,
  markDirty: () => set({ dirty: true }),
  markSaved: () => set({ dirty: false }),
}));

/** Subscribes to every store a Settings section can edit, marking dirty on
 * any change. Call once from SettingsScreen's top-level component (not a
 * per-section one) so it covers every section regardless of which is
 * currently showing, and returns an unsubscribe function for cleanup. */
export function watchForSettingsChanges(): () => void {
  const markDirty = () => useSettingsDirtyStore.getState().markDirty();
  const unsubs = [
    useSettingsStore.subscribe(markDirty),
    useAppLockStore.subscribe(markDirty),
    useFamilyStore.subscribe(markDirty),
  ];
  return () => unsubs.forEach((u) => u());
}
