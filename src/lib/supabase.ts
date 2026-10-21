import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Both of these are read from the environment at build time. Expo exposes
// any env var prefixed EXPO_PUBLIC_ to client code automatically (see
// app.json / .env — there is a .env.example checked in with the two names
// this file expects). They end up baked into the JS bundle, so they must be
// the *anon* (public) key — never the service_role key — see the Supabase
// setup instructions in README.md.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True once both env vars are present — gates whether the app talks to
 * Supabase at all, or falls back to in-memory seed data (see each store's
 * `hydrate()` for what that fallback looks like). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set — ' +
      'Roost is running on temporary, in-memory sample data. Nothing you change will be saved ' +
      'or synced until these are configured. See README.md → "Setting up Supabase".',
  );
}

// A dummy local placeholder client when not configured, so every store can
// unconditionally `import { supabase }` without null-checking at every call
// site — every method on it just throws, and every store already guards its
// calls behind `isSupabaseConfigured` before touching `supabase`.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        // Real per-family login (see migrate_v8.sql) — the session needs to
        // persist across app restarts (same AsyncStorage every other
        // persisted store in this app already uses) and refresh itself
        // automatically, or everyone would have to sign back in constantly.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);
