import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { todayIso } from '../lib/date';
import { fetchVerseOfDay } from '../lib/verseFeed';
import {
  seedBoardColumns,
  seedBoardItems,
  seedChores,
  seedEvents,
  seedFamily,
  seedMeals,
  seedMealSuggestions,
} from '../data/seed';
import { seedRecipes } from '../data/recipes';
import {
  BoardColumn,
  BoardItem,
  CalendarEvent,
  Chore,
  FamilyMember,
  Meal,
  MealSuggestion,
  Recipe,
  ThemePreference,
  WidgetId,
  WidgetSize,
} from './types';

const storage = createJSONStorage(() => AsyncStorage);

// ---------------------------------------------------------------------------
// Supabase sync helpers
// ---------------------------------------------------------------------------
// Family data (members, chores, meals, boards, calendar events) used to live
// only in AsyncStorage on-device. It now lives in Supabase — every store
// below still keeps a local copy in memory (so screens read/render exactly
// as before, synchronously, no loading spinners scattered through the UI),
// but that local copy is now a live mirror of the `public.*` tables in your
// Supabase project rather than the source of truth itself:
//   1. `hydrateAllStores()` (called once from App.tsx) fetches every row on
//      launch and opens one Realtime subscription per table, so this
//      device's view stays in sync with changes made from any other
//      device/tablet/phone signed into the same Supabase project.
//   2. Every mutating action (add/update/remove/toggle/...) updates local
//      state immediately (so the UI never waits on the network) and fires
//      the matching Supabase write in the background; failures are logged
//      to the console rather than surfaced as an alert, since a transient
//      network hiccup shouldn't interrupt someone mid-task — the next
//      realtime sync (or app reload) reconciles things.
//   3. Supabase is the source of truth whenever it's reachable — including
//      its *emptiness*. If you delete every row of a table in Supabase, the
//      app shows that table as empty too, rather than quietly falling back
//      to old seed/demo names forever. The only time the app falls back to
//      whatever it already has is when Supabase genuinely can't be reached
//      (not configured, timed out, errored) — see fetchTable's `ok` flag.
// If EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY aren't set
// (see src/lib/supabase.ts), every store just keeps its seed data in memory
// for the session — nothing is persisted anywhere. See README.md →
// "Setting up Supabase".

// ---------------------------------------------------------------------------
// Supabase connection/sync status — NOT persisted; a live, in-memory
// diagnostic so it's obvious *why* the app might be showing old/sample data
// instead of having to guess from a browser console log. Rendered in
// Settings → Database. Every `fetchTable()` call (one per table, on launch,
// or from the "Refresh From Database" button) records whether it actually
// reached Supabase and how many rows came back; every failed write records
// the most recent error.
// ---------------------------------------------------------------------------
type TableFetchStatus = { ok: boolean; rows: number; at: string };

type SyncStatusState = {
  tables: Record<string, TableFetchStatus>;
  lastError: { table: string; action: string; message: string; at: string } | null;
  recordFetch: (table: string, ok: boolean, rows: number) => void;
  recordError: (table: string, action: string, message: string) => void;
};

export const useSyncStatusStore = create<SyncStatusState>()((set) => ({
  tables: {},
  lastError: null,
  recordFetch: (table, ok, rows) =>
    set((s) => ({ tables: { ...s.tables, [table]: { ok, rows, at: new Date().toISOString() } } })),
  recordError: (table, action, message) => set({ lastError: { table, action, message, at: new Date().toISOString() } }),
}));

function logSyncError(action: string, table: string, error: unknown) {
  // Supabase's PostgrestError has a `.message` but isn't an `instanceof
  // Error`, so check for a message property before falling back to a raw
  // JSON dump — the difference between a clean one-line reason and an
  // unreadable object blob in Settings → Database.
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : JSON.stringify(error);
  // eslint-disable-next-line no-console
  console.error(`[supabase] ${action} on "${table}" failed —`, error);
  useSyncStatusStore.getState().recordError(table, action, message);
}

function syncInsert(table: string, row: Record<string, unknown>) {
  if (!isSupabaseConfigured) return;
  supabase
    .from(table)
    .insert(row)
    .then(({ error }: { error: unknown }) => {
      if (error) logSyncError('insert', table, error);
    });
}

function syncUpdate(table: string, id: string, patch: Record<string, unknown>) {
  if (!isSupabaseConfigured) return;
  supabase
    .from(table)
    .update(patch)
    .eq('id', id)
    .then(({ error }: { error: unknown }) => {
      if (error) logSyncError('update', table, error);
    });
}

function syncDelete(table: string, id: string) {
  if (!isSupabaseConfigured) return;
  supabase
    .from(table)
    .delete()
    .eq('id', id)
    .then(({ error }: { error: unknown }) => {
      if (error) logSyncError('delete', table, error);
    });
}

// This is a wall-mounted display — it must never sit on a loading spinner
// indefinitely because a Supabase project is paused, unreachable, or just
// slow to respond. Every initial fetch gets a hard timeout (in addition to
// the belt-and-suspenders timeout around the whole hydration pass in
// App.tsx) so a bad network moment degrades to "show the seed/last-known
// data" rather than "show nothing, forever".
const FETCH_TIMEOUT_MS = 8000;

/** Fetch every row of `table`. `ok: true` means Supabase is the source of
 * truth for this call — the app is meant to be *reliant* on the database,
 * so an empty-but-reachable table means the app shows empty too (a
 * genuinely deleted-down-to-nothing table is not the same thing as "we
 * couldn't reach the database"). `ok: false` (not configured, timed out,
 * or errored) is the only case where the caller should keep whatever it
 * already has (seed data on a first launch, or last-known-good data)
 * rather than trust `rows` (always `[]` in that case). This never throws. */
async function fetchTable(table: string): Promise<{ ok: boolean; rows: any[] }> {
  if (!isSupabaseConfigured) {
    useSyncStatusStore.getState().recordFetch(table, false, 0);
    return { ok: false, rows: [] };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const { data, error } = await supabase.from(table).select('*').abortSignal(controller.signal);
    if (error) {
      // supabase-js sometimes surfaces the abort as a normal query error
      // object here rather than throwing — `controller.signal.aborted` is
      // the ground truth for "this was our own timeout" either way, so both
      // this branch and the catch below check it the same way rather than
      // guessing from the error's shape (which differs between a thrown
      // DOMException and a returned PostgrestError).
      const action = controller.signal.aborted ? `fetch (timed out after ${FETCH_TIMEOUT_MS / 1000}s)` : 'fetch';
      logSyncError(action, table, error);
      useSyncStatusStore.getState().recordFetch(table, false, 0);
      return { ok: false, rows: [] };
    }
    const rows = data ?? [];
    // eslint-disable-next-line no-console
    console.log(`[supabase] fetched "${table}": ${rows.length} row(s)`);
    useSyncStatusStore.getState().recordFetch(table, true, rows.length);
    return { ok: true, rows };
  } catch (err) {
    const action = controller.signal.aborted
      ? `fetch (timed out after ${FETCH_TIMEOUT_MS / 1000}s)`
      : 'fetch (network error)';
    logSyncError(action, table, err);
    useSyncStatusStore.getState().recordFetch(table, false, 0);
    return { ok: false, rows: [] };
  } finally {
    clearTimeout(timeout);
  }
}

/** Opens a Realtime subscription for `table` and routes INSERT/UPDATE rows
 * through `upsert` (add-or-replace-by-id — covers both a genuinely new row
 * from another device AND the echo of this device's own optimistic write)
 * and DELETEs through `remove`. Each store calls this once, from its own
 * `hydrate()`, guarded so a second call is a no-op. */
function subscribeRealtime(table: string, upsert: (row: any) => void, remove: (id: string) => void) {
  if (!isSupabaseConfigured) return;
  supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload: any) => upsert(payload.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, (payload: any) => upsert(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload: any) => remove(payload.old.id))
    .subscribe();
}

// ---------------------------------------------------------------------------
// Family members
// ---------------------------------------------------------------------------
function memberFromRow(row: any): FamilyMember {
  return { id: row.id, name: row.name, birthday: row.birthday ?? undefined, color: row.color, initials: row.initials };
}
function memberToRow(id: string, m: Partial<Omit<FamilyMember, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (m.name !== undefined) row.name = m.name;
  if (m.birthday !== undefined) row.birthday = m.birthday ?? null;
  if (m.color !== undefined) row.color = m.color;
  if (m.initials !== undefined) row.initials = m.initials;
  return row;
}

type FamilyState = {
  members: FamilyMember[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addMember: (m: Omit<FamilyMember, 'id'>) => string;
  updateMember: (id: string, patch: Partial<Omit<FamilyMember, 'id'>>) => void;
  removeMember: (id: string) => void;
};

let familySubscribed = false;

export const useFamilyStore = create<FamilyState>()((set, get) => ({
  members: seedFamily,
  hydrated: false,
  hydrate: async () => {
    const { ok, rows } = await fetchTable('family_members');
    if (ok) set({ members: rows.map(memberFromRow) });
    set({ hydrated: true });
    if (!familySubscribed) {
      familySubscribed = true;
      subscribeRealtime(
        'family_members',
        (row) => {
          const m = memberFromRow(row);
          set((s) => ({
            members: s.members.some((x) => x.id === m.id)
              ? s.members.map((x) => (x.id === m.id ? m : x))
              : [...s.members, m],
          }));
        },
        (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id) })),
      );
    }
  },
  addMember: (m) => {
    const id = makeId();
    set((s) => ({ members: [...s.members, { ...m, id }] }));
    syncInsert('family_members', memberToRow(id, m));
    return id;
  },
  updateMember: (id, patch) => {
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    syncUpdate('family_members', id, memberToRow(id, patch));
  },
  removeMember: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    syncDelete('family_members', id);
  },
}));

// ---------------------------------------------------------------------------
// Chores
// ---------------------------------------------------------------------------
function choreFromRow(row: any): Chore {
  return { id: row.id, title: row.title, assigneeId: row.assignee_id, points: row.points, done: row.done };
}
function choreToRow(id: string, c: Partial<Omit<Chore, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (c.title !== undefined) row.title = c.title;
  if (c.assigneeId !== undefined) row.assignee_id = c.assigneeId;
  if (c.points !== undefined) row.points = c.points;
  if (c.done !== undefined) row.done = c.done;
  return row;
}

type ChoresState = {
  chores: Chore[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addChore: (c: Omit<Chore, 'id' | 'done'>) => void;
  updateChore: (id: string, patch: Partial<Omit<Chore, 'id'>>) => void;
  toggleChore: (id: string) => void;
  claimChore: (id: string, assigneeId: string) => void;
  removeChore: (id: string) => void;
  resetWeek: () => void;
};

let choresSubscribed = false;

export const useChoresStore = create<ChoresState>()((set, get) => ({
  chores: seedChores,
  hydrated: false,
  hydrate: async () => {
    const { ok, rows } = await fetchTable('chores');
    if (ok) set({ chores: rows.map(choreFromRow) });
    set({ hydrated: true });
    if (!choresSubscribed) {
      choresSubscribed = true;
      subscribeRealtime(
        'chores',
        (row) => {
          const c = choreFromRow(row);
          set((s) => ({
            chores: s.chores.some((x) => x.id === c.id) ? s.chores.map((x) => (x.id === c.id ? c : x)) : [...s.chores, c],
          }));
        },
        (id) => set((s) => ({ chores: s.chores.filter((c) => c.id !== id) })),
      );
    }
  },
  addChore: (c) => {
    const id = makeId();
    const chore: Chore = { ...c, id, done: false };
    set((s) => ({ chores: [...s.chores, chore] }));
    syncInsert('chores', choreToRow(id, chore));
  },
  updateChore: (id, patch) => {
    set((s) => ({ chores: s.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    syncUpdate('chores', id, choreToRow(id, patch));
  },
  toggleChore: (id) => {
    const nextDone = !(get().chores.find((c) => c.id === id)?.done ?? false);
    set((s) => ({ chores: s.chores.map((c) => (c.id === id ? { ...c, done: nextDone } : c)) }));
    syncUpdate('chores', id, { done: nextDone });
  },
  claimChore: (id, assigneeId) => {
    set((s) => ({ chores: s.chores.map((c) => (c.id === id ? { ...c, assigneeId } : c)) }));
    syncUpdate('chores', id, { assignee_id: assigneeId });
  },
  removeChore: (id) => {
    set((s) => ({ chores: s.chores.filter((c) => c.id !== id) }));
    syncDelete('chores', id);
  },
  resetWeek: () => {
    const ids = get().chores.map((c) => c.id);
    set((s) => ({ chores: s.chores.map((c) => ({ ...c, done: false })) }));
    if (isSupabaseConfigured && ids.length) {
      supabase
        .from('chores')
        .update({ done: false })
        .in('id', ids)
        .then(({ error }: { error: unknown }) => {
          if (error) logSyncError('bulk update', 'chores', error);
        });
    }
  },
}));

// ---------------------------------------------------------------------------
// Meal plans
// ---------------------------------------------------------------------------
function mealFromRow(row: any): Meal {
  return {
    id: row.id,
    day: row.day,
    slot: row.slot,
    name: row.name,
    chefIds: row.chef_ids ?? [],
    notes: row.notes ?? undefined,
    rating: row.rating ?? undefined,
  };
}
function mealToRow(id: string, m: Partial<Omit<Meal, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (m.day !== undefined) row.day = m.day;
  if (m.slot !== undefined) row.slot = m.slot;
  if (m.name !== undefined) row.name = m.name;
  if (m.chefIds !== undefined) row.chef_ids = m.chefIds;
  if (m.notes !== undefined) row.notes = m.notes ?? null;
  if (m.rating !== undefined) row.rating = m.rating ?? null;
  return row;
}

type MealsState = {
  meals: Meal[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsertMeal: (m: Omit<Meal, 'id'> & { id?: string }) => void;
  removeMeal: (id: string) => void;
};

let mealsSubscribed = false;

export const useMealsStore = create<MealsState>()((set, get) => ({
  meals: seedMeals,
  hydrated: false,
  hydrate: async () => {
    const { ok, rows } = await fetchTable('meals');
    if (ok) set({ meals: rows.map(mealFromRow) });
    set({ hydrated: true });
    if (!mealsSubscribed) {
      mealsSubscribed = true;
      subscribeRealtime(
        'meals',
        (row) => {
          const m = mealFromRow(row);
          set((s) => ({
            meals: s.meals.some((x) => x.id === m.id) ? s.meals.map((x) => (x.id === m.id ? m : x)) : [...s.meals, m],
          }));
        },
        (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
      );
    }
  },
  upsertMeal: (m) => {
    if (m.id) {
      const id = m.id;
      set((s) => ({ meals: s.meals.map((x) => (x.id === id ? { ...x, ...m, id } : x)) }));
      syncUpdate('meals', id, mealToRow(id, m));
    } else {
      const id = makeId();
      const meal: Meal = { ...m, id };
      set((s) => ({ meals: [...s.meals, meal] }));
      syncInsert('meals', mealToRow(id, meal));
    }
  },
  removeMeal: (id) => {
    set((s) => ({ meals: s.meals.filter((m) => m.id !== id) }));
    syncDelete('meals', id);
  },
}));

// ---------------------------------------------------------------------------
// Boards (To-Do / Wishlist / Shopping List / custom)
// ---------------------------------------------------------------------------
function columnFromRow(row: any): BoardColumn {
  return { id: row.id, title: row.title, color: row.color };
}
function columnToRow(id: string, c: Partial<Omit<BoardColumn, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (c.title !== undefined) row.title = c.title;
  if (c.color !== undefined) row.color = c.color;
  return row;
}
function itemFromRow(row: any): BoardItem {
  return {
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description ?? undefined,
    ownerId: row.owner_id,
    done: row.done,
    doneAt: row.done_at ?? null,
    autoDelete: row.auto_delete ?? null,
  };
}
function itemToRow(id: string, i: Partial<Omit<BoardItem, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (i.columnId !== undefined) row.column_id = i.columnId;
  if (i.title !== undefined) row.title = i.title;
  if (i.description !== undefined) row.description = i.description ?? null;
  if (i.ownerId !== undefined) row.owner_id = i.ownerId ?? null;
  if (i.done !== undefined) row.done = i.done;
  if (i.doneAt !== undefined) row.done_at = i.doneAt ?? null;
  if (i.autoDelete !== undefined) row.auto_delete = i.autoDelete ?? null;
  return row;
}

// How long a checked-off board/list item is kept before the auto-delete
// sweep (below) removes it — everything except 'immediately', which instead
// skips `done` entirely and deletes the item the moment it's checked (see
// `toggleItem`).
const AUTO_DELETE_MS: Record<'72h' | 'month' | 'year', number> = {
  '72h': 72 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function sweepAutoDeleteBoardItems() {
  const { items, removeItem } = useBoardsStore.getState();
  const now = Date.now();
  for (const item of items) {
    if (!item.done || !item.doneAt) continue;
    if (!item.autoDelete || item.autoDelete === 'immediately') continue;
    const elapsed = now - new Date(item.doneAt).getTime();
    if (elapsed >= AUTO_DELETE_MS[item.autoDelete]) {
      removeItem(item.id);
    }
  }
}

let autoDeleteSweepStarted = false;
/** Starts the recurring check for board items whose "delete automatically
 * after..." timer has elapsed (set in the Boards screen's add/edit item
 * popup). This is a plain client-side interval rather than a server-side
 * cron job — there's no backend compute in this app's Supabase project, and
 * the app's whole reason for existing is to be open on a wall-mounted
 * tablet, so a check every few minutes while it's running is plenty timely.
 * Safe to call more than once; only the first call actually starts the
 * interval. Called once from hydrateAllStores(). */
function startAutoDeleteSweep() {
  if (autoDeleteSweepStarted) return;
  autoDeleteSweepStarted = true;
  sweepAutoDeleteBoardItems();
  setInterval(sweepAutoDeleteBoardItems, 5 * 60 * 1000);
}

type BoardsState = {
  columns: BoardColumn[];
  items: BoardItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addColumn: (c: Omit<BoardColumn, 'id'>) => void;
  removeColumn: (id: string) => void;
  addItem: (i: Omit<BoardItem, 'id' | 'done' | 'doneAt'>) => void;
  updateItem: (id: string, patch: Partial<Omit<BoardItem, 'id'>>) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
};

let boardsSubscribed = false;

export const useBoardsStore = create<BoardsState>()((set, get) => ({
  columns: seedBoardColumns,
  items: seedBoardItems,
  hydrated: false,
  hydrate: async () => {
    const [columnRes, itemRes] = await Promise.all([fetchTable('board_columns'), fetchTable('board_items')]);
    if (columnRes.ok) set({ columns: columnRes.rows.map(columnFromRow) });
    if (itemRes.ok) set({ items: itemRes.rows.map(itemFromRow) });
    set({ hydrated: true });
    if (!boardsSubscribed) {
      boardsSubscribed = true;
      subscribeRealtime(
        'board_columns',
        (row) => {
          const c = columnFromRow(row);
          set((s) => ({
            columns: s.columns.some((x) => x.id === c.id) ? s.columns.map((x) => (x.id === c.id ? c : x)) : [...s.columns, c],
          }));
        },
        (id) => set((s) => ({ columns: s.columns.filter((c) => c.id !== id) })),
      );
      subscribeRealtime(
        'board_items',
        (row) => {
          const i = itemFromRow(row);
          set((s) => ({
            items: s.items.some((x) => x.id === i.id) ? s.items.map((x) => (x.id === i.id ? i : x)) : [...s.items, i],
          }));
        },
        (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      );
    }
  },
  addColumn: (c) => {
    const id = makeId();
    set((s) => ({ columns: [...s.columns, { ...c, id }] }));
    syncInsert('board_columns', columnToRow(id, c));
  },
  removeColumn: (id) => {
    set((s) => ({
      columns: s.columns.filter((c) => c.id !== id),
      items: s.items.filter((i) => i.columnId !== id),
    }));
    // `board_items.column_id` has `on delete cascade`, so deleting the
    // column server-side takes its items with it — no separate item deletes.
    syncDelete('board_columns', id);
  },
  addItem: (i) => {
    const id = makeId();
    const item: BoardItem = { ...i, id, done: false, doneAt: null };
    set((s) => ({ items: [...s.items, item] }));
    syncInsert('board_items', itemToRow(id, item));
  },
  updateItem: (id, patch) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    syncUpdate('board_items', id, itemToRow(id, patch));
  },
  toggleItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const nextDone = !item.done;
    // "Immediately" skips the checked-off state altogether — the item
    // disappears the instant it's checked, same as tapping Delete, rather
    // than lingering done-and-struck-through until the next sweep.
    if (nextDone && item.autoDelete === 'immediately') {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      syncDelete('board_items', id);
      return;
    }
    const doneAt = nextDone ? new Date().toISOString() : null;
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done: nextDone, doneAt } : i)) }));
    syncUpdate('board_items', id, { done: nextDone, done_at: doneAt });
  },
  removeItem: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    syncDelete('board_items', id);
  },
}));

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------
function eventFromRow(row: any): CalendarEvent {
  return {
    id: row.id,
    date: row.date,
    time: row.time ?? undefined,
    endTime: row.end_time ?? undefined,
    title: row.title,
    personIds: row.person_ids ?? [],
    source: row.source,
  };
}
function eventToRow(id: string, e: Partial<Omit<CalendarEvent, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (e.date !== undefined) row.date = e.date;
  if (e.time !== undefined) row.time = e.time ?? null;
  if (e.endTime !== undefined) row.end_time = e.endTime ?? null;
  if (e.title !== undefined) row.title = e.title;
  if (e.personIds !== undefined) row.person_ids = e.personIds;
  if (e.source !== undefined) row.source = e.source;
  return row;
}

type CalendarState = {
  events: CalendarEvent[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addEvent: (e: Omit<CalendarEvent, 'id' | 'source'>) => void;
  updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => void;
  removeEvent: (id: string) => void;
  replaceSyncedEvents: (source: 'google' | 'apple', events: Omit<CalendarEvent, 'source'>[]) => void;
};

let calendarSubscribed = false;

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  events: seedEvents,
  hydrated: false,
  hydrate: async () => {
    const { ok, rows } = await fetchTable('calendar_events');
    if (ok) set({ events: rows.map(eventFromRow) });
    set({ hydrated: true });
    if (!calendarSubscribed) {
      calendarSubscribed = true;
      subscribeRealtime(
        'calendar_events',
        (row) => {
          const e = eventFromRow(row);
          set((s) => ({
            events: s.events.some((x) => x.id === e.id) ? s.events.map((x) => (x.id === e.id ? e : x)) : [...s.events, e],
          }));
        },
        (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      );
    }
  },
  addEvent: (e) => {
    const id = makeId();
    const event: CalendarEvent = { ...e, id, source: 'local' };
    set((s) => ({ events: [...s.events, event] }));
    syncInsert('calendar_events', eventToRow(id, event));
  },
  updateEvent: (id, patch) => {
    set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
    syncUpdate('calendar_events', id, eventToRow(id, patch));
  },
  removeEvent: (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    syncDelete('calendar_events', id);
  },
  // Swaps out all previously-synced events from one source with a fresh
  // batch — called after a Google/Apple calendar sync round-trip.
  replaceSyncedEvents: (source, events) => {
    const stamped = events.map((e) => ({ ...e, source }));
    set((s) => ({
      events: [...s.events.filter((e) => e.source !== source), ...stamped],
    }));
    if (isSupabaseConfigured) {
      (async () => {
        const { error: delErr } = await supabase.from('calendar_events').delete().eq('source', source);
        if (delErr) logSyncError('delete (pre-sync)', 'calendar_events', delErr);
        if (stamped.length) {
          const { error: insErr } = await supabase
            .from('calendar_events')
            .insert(stamped.map((e) => eventToRow(e.id, e)));
          if (insErr) logSyncError('bulk insert', 'calendar_events', insErr);
        }
      })();
    }
  },
}));

// ---------------------------------------------------------------------------
// Recipes — the Recipes screen's library. `ingredients` is stored as jsonb
// (an array of {amount, name} objects) rather than a second table; supabase-js
// already parses jsonb columns into plain JS values, so recipeFromRow can
// use it directly, same as the text[] array columns elsewhere in this file.
// ---------------------------------------------------------------------------
function recipeFromRow(row: any): Recipe {
  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    time: row.time,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
  };
}
function recipeToRow(id: string, r: Partial<Omit<Recipe, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (r.name !== undefined) row.name = r.name;
  if (r.slot !== undefined) row.slot = r.slot;
  if (r.time !== undefined) row.time = r.time;
  if (r.ingredients !== undefined) row.ingredients = r.ingredients;
  if (r.steps !== undefined) row.steps = r.steps;
  return row;
}

type RecipesState = {
  recipes: Recipe[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addRecipe: (r: Omit<Recipe, 'id'>) => void;
  updateRecipe: (id: string, patch: Partial<Omit<Recipe, 'id'>>) => void;
  removeRecipe: (id: string) => void;
};

let recipesSubscribed = false;

export const useRecipesStore = create<RecipesState>()((set, get) => ({
  recipes: seedRecipes,
  hydrated: false,
  hydrate: async () => {
    const { ok, rows } = await fetchTable('recipes');
    if (ok) set({ recipes: rows.map(recipeFromRow) });
    set({ hydrated: true });
    if (!recipesSubscribed) {
      recipesSubscribed = true;
      subscribeRealtime(
        'recipes',
        (row) => {
          const r = recipeFromRow(row);
          set((s) => ({
            recipes: s.recipes.some((x) => x.id === r.id) ? s.recipes.map((x) => (x.id === r.id ? r : x)) : [...s.recipes, r],
          }));
        },
        (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),
      );
    }
  },
  addRecipe: (r) => {
    const id = makeId();
    const recipe: Recipe = { ...r, id };
    set((s) => ({ recipes: [...s.recipes, recipe] }));
    syncInsert('recipes', recipeToRow(id, recipe));
  },
  updateRecipe: (id, patch) => {
    set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    syncUpdate('recipes', id, recipeToRow(id, patch));
  },
  removeRecipe: (id) => {
    set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) }));
    syncDelete('recipes', id);
  },
}));

// ---------------------------------------------------------------------------
// Meal suggestions — the Suggestions screen's "Meal ideas" list. Picking a
// day (day/slot) is optional at submission time (see SuggestionsScreen); an
// idea can be scheduled later from the ideas list itself, which just fills
// in day/slot on the same row rather than creating a new record.
// ---------------------------------------------------------------------------
function suggestionFromRow(row: any): MealSuggestion {
  return {
    id: row.id,
    name: row.name,
    suggestedByIds: row.suggested_by_ids ?? [],
    day: row.day ?? null,
    slot: row.slot ?? null,
  };
}
function suggestionToRow(id: string, s: Partial<Omit<MealSuggestion, 'id'>>) {
  const row: Record<string, unknown> = { id };
  if (s.name !== undefined) row.name = s.name;
  if (s.suggestedByIds !== undefined) row.suggested_by_ids = s.suggestedByIds;
  if (s.day !== undefined) row.day = s.day ?? null;
  if (s.slot !== undefined) row.slot = s.slot ?? null;
  return row;
}

type SuggestionsState = {
  suggestions: MealSuggestion[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addSuggestion: (s: Omit<MealSuggestion, 'id'>) => void;
  updateSuggestion: (id: string, patch: Partial<Omit<MealSuggestion, 'id'>>) => void;
  removeSuggestion: (id: string) => void;
};

let suggestionsSubscribed = false;

export const useSuggestionsStore = create<SuggestionsState>()((set, get) => ({
  suggestions: seedMealSuggestions,
  hydrated: false,
  hydrate: async () => {
    const { ok, rows } = await fetchTable('meal_suggestions');
    if (ok) set({ suggestions: rows.map(suggestionFromRow) });
    set({ hydrated: true });
    if (!suggestionsSubscribed) {
      suggestionsSubscribed = true;
      subscribeRealtime(
        'meal_suggestions',
        (row) => {
          const s2 = suggestionFromRow(row);
          set((s) => ({
            suggestions: s.suggestions.some((x) => x.id === s2.id)
              ? s.suggestions.map((x) => (x.id === s2.id ? s2 : x))
              : [...s.suggestions, s2],
          }));
        },
        (id) => set((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id) })),
      );
    }
  },
  addSuggestion: (s) => {
    const id = makeId();
    const suggestion: MealSuggestion = { ...s, id };
    set((st) => ({ suggestions: [...st.suggestions, suggestion] }));
    syncInsert('meal_suggestions', suggestionToRow(id, suggestion));
  },
  updateSuggestion: (id, patch) => {
    set((st) => ({ suggestions: st.suggestions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    syncUpdate('meal_suggestions', id, suggestionToRow(id, patch));
  },
  removeSuggestion: (id) => {
    set((st) => ({ suggestions: st.suggestions.filter((x) => x.id !== id) }));
    syncDelete('meal_suggestions', id);
  },
}));

// ---------------------------------------------------------------------------
// Verse of the Day — pulled from OurManna's JSON API (see
// src/lib/verseFeed.ts) instead of the app's own small built-in rotation.
// Cached here (persisted, so it survives a reload without refetching) keyed
// by the date it was fetched for; VerseWidgetContent shows its own local
// fallback verse whenever there's nothing cached for today yet (first load,
// or the fetch failed) and swaps in the fetched text once/if it arrives.
// ---------------------------------------------------------------------------
type VerseState = {
  date: string | null;
  text: string | null;
  reference: string | null;
  fetching: boolean;
  fetchIfNeeded: () => Promise<void>;
};

export const useVerseStore = create<VerseState>()(
  persist(
    (set, get) => ({
      date: null,
      text: null,
      reference: null,
      fetching: false,
      fetchIfNeeded: async () => {
        const today = todayIso();
        const { date, fetching } = get();
        if (date === today || fetching) return;
        set({ fetching: true });
        const item = await fetchVerseOfDay();
        if (item) {
          set({ date: today, text: item.text, reference: item.reference, fetching: false });
        } else {
          // Couldn't reach/parse the API this time (offline, the API down,
          // or an unexpected response) — leave `date` unset so the next
          // launch (or the next call while this one's still open) tries
          // again, instead of getting stuck on "no answer" for the rest of
          // the day. The widget shows its own local fallback verse in the
          // meantime.
          set({ fetching: false });
        }
      },
    }),
    { name: 'roost.verse', storage },
  ),
);

// ---------------------------------------------------------------------------
// Bootstrap — call once from App.tsx before rendering the rest of the app.
// ---------------------------------------------------------------------------
export async function hydrateAllStores(): Promise<void> {
  await Promise.all([
    useFamilyStore.getState().hydrate(),
    useChoresStore.getState().hydrate(),
    useMealsStore.getState().hydrate(),
    useBoardsStore.getState().hydrate(),
    useCalendarStore.getState().hydrate(),
    useRecipesStore.getState().hydrate(),
    useSuggestionsStore.getState().hydrate(),
  ]);
  // These two are deliberately NOT awaited above: the verse fetch is a
  // "nice to have" (VerseWidgetContent already shows a local fallback verse
  // instantly and swaps in the fetched text if/when it arrives) and
  // shouldn't be able to delay the wall display's boot the way a slow or
  // unreachable third-party API could; the auto-delete sweep is a
  // recurring background job, not something to wait on either.
  useVerseStore.getState().fetchIfNeeded();
  startAutoDeleteSweep();
}

// ---------------------------------------------------------------------------
// Settings (theme, notifications, calendar visibility filter, sync status)
// ---------------------------------------------------------------------------
// These stay device-local (AsyncStorage) rather than moving to Supabase —
// they're display/device preferences (which theme *this* screen uses, which
// people *this* screen currently has filtered out), not shared family data.
type SettingsState = {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;

  hiddenPersonIds: string[];
  togglePersonVisibility: (personId: string) => void;

  notifications: { chores: boolean; events: boolean; daily: boolean };
  setNotification: (key: 'chores' | 'events' | 'daily', value: boolean) => void;

  google: { connected: boolean; email?: string };
  setGoogleConnection: (connected: boolean, email?: string) => void;

  apple: { connected: boolean; appleId?: string };
  setAppleConnection: (connected: boolean, appleId?: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      hiddenPersonIds: [],
      togglePersonVisibility: (personId) =>
        set((s) => ({
          hiddenPersonIds: s.hiddenPersonIds.includes(personId)
            ? s.hiddenPersonIds.filter((id) => id !== personId)
            : [...s.hiddenPersonIds, personId],
        })),

      notifications: { chores: true, events: true, daily: false },
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),

      google: { connected: false },
      setGoogleConnection: (connected, email) => set({ google: { connected, email } }),

      apple: { connected: false },
      setAppleConnection: (connected, appleId) => set({ apple: { connected, appleId } }),
    }),
    { name: 'roost.settings', storage },
  ),
);

// ---------------------------------------------------------------------------
// Home dashboard layout — also device-local: which widgets show more/less
// detail on *this* screen. Positions are now fixed to match the design's
// 3-column grid (see HomeScreen.tsx), so this only tracks per-widget detail
// level any more, not order.
// ---------------------------------------------------------------------------
const defaultWidgetSizes: Record<WidgetId, WidgetSize> = {
  calendar: 'lg',
  events: 'md',
  meal: 'md',
  todo: 'sm',
  challenge: 'md',
  verse: 'md',
  chores: 'md',
};

type DashboardLayoutState = {
  sizes: Record<WidgetId, WidgetSize>;
  setSize: (id: WidgetId, size: WidgetSize) => void;
  resetLayout: () => void;
};

// ---------------------------------------------------------------------------
// Daily challenge — "Would You Rather" votes. Kept device-local (like the
// other persisted slices in this file) rather than synced to Supabase: the
// wall tablet is where the family gathers to vote, and each person picks who
// they are from the family list before tapping an option, so one device
// holds the whole tally. `votesDate` pins the tally to a single day — the
// widget shows an empty tally on any day whose date doesn't match, and the
// first vote of a new day clears the previous day's votes. So a new "Would
// You Rather" always starts fresh the next morning, and a plain "Question"
// day (no options) just shows no voting UI at all.
// ---------------------------------------------------------------------------
type DailyChoice = 'A' | 'B';

type DailyState = {
  votesDate: string | null;
  /** family member id -> their pick for `votesDate` */
  votes: Record<string, DailyChoice>;
  /** Record one person's vote for `date` — or, if they tap the option they
   * already picked, retract it. Rolls the tally over to a fresh day on the
   * first vote whose `date` differs from `votesDate`. */
  castVote: (date: string, personId: string, choice: DailyChoice) => void;
};

export const useDailyStore = create<DailyState>()(
  persist(
    (set) => ({
      votesDate: null,
      votes: {},
      castVote: (date, personId, choice) =>
        set((s) => {
          const base = s.votesDate === date ? s.votes : {};
          const next = { ...base };
          if (next[personId] === choice) {
            delete next[personId];
          } else {
            next[personId] = choice;
          }
          return { votesDate: date, votes: next };
        }),
    }),
    // Bumped from 'roost.daily' (which persisted a single {answeredDate,
    // answer}) — the old shape has no `votes`, so a fresh key avoids merging
    // a `votes: undefined` into the new state on upgrade.
    { name: 'roost.daily.v2', storage },
  ),
);

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      sizes: defaultWidgetSizes,
      setSize: (id, size) => set((s) => ({ sizes: { ...s.sizes, [id]: size } })),
      resetLayout: () => set({ sizes: defaultWidgetSizes }),
    }),
    { name: 'roost.dashboardLayout.v2', storage },
  ),
);