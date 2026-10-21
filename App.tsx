import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as KeepAwake from 'expo-keep-awake';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { useAppFonts } from './src/theme/useAppFonts';
import { RootNavigator } from './src/navigation/RootNavigator';
import { hydrateAllStores, initAuth, useAppLockStore, useAuthStore, useSettingsStore } from './src/store/useAppStore';
import { isSupabaseConfigured } from './src/lib/supabase';
import { LockScreen } from './src/screens/LockScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AmbientScreen } from './src/screens/AmbientScreen';
import { HuddleControls } from './src/components/HuddleControls';
import { UiScaleWrapper } from './src/components/UiScaleWrapper';
import { useIdleTimer } from './src/lib/useIdleTimer';
import { applyNativeBrightness, restoreSystemBrightness } from './src/lib/brightness';

// Required for expo-auth-session's OAuth flow: when the Google redirect lands
// back in this window (a popup on web, the in-app browser on native), this
// hands the result to the code that called promptAsync() and closes the
// popup/browser. Without it, promptAsync() never resolves — the Settings
// "Connect" button appears to do nothing and the sign-in response stays null.
// Must run at module scope, before anything renders.
WebBrowser.maybeCompleteAuthSession();

function AppShell() {
  const fontsLoaded = useAppFonts();
  const [authInitialized, setAuthInitialized] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const theme = useTheme();
  const householdId = useAuthStore((s) => s.householdId);
  const pinHash = useAppLockStore((s) => s.pinHash);
  const unlocked = useAppLockStore((s) => s.unlocked);
  const ambient = useSettingsStore((s) => s.ambient);

  // Real per-family login (see useAuthStore / migrate_v8.sql) gates
  // everything below it — there's nothing to hydrate from Supabase until a
  // household is signed in. Skipped entirely when Supabase isn't configured
  // at all (local/demo mode), so that fallback keeps working unauthenticated
  // exactly as it always has.
  const needsAuth = isSupabaseConfigured && authInitialized && !householdId;

  useEffect(() => {
    initAuth().then(() => setAuthInitialized(true));
  }, []);

  // This is meant to be an always-on wall display — keep the OS from ever
  // screen-locking/sleeping it while the app is open. The ambient
  // screensaver (below) is what takes over visually instead, on its own
  // schedule, rather than the device just going black.
  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync();
    return () => {
      KeepAwake.deactivateKeepAwake();
    };
  }, []);

  // In-app brightness (Settings → Screensaver) — there's no physical
  // brightness button on a wall-mounted tablet. Applies globally, not just
  // during the screensaver. No-op on web (see AmbientScreen's dim overlay,
  // and the dim overlay below, for the web equivalent).
  useEffect(() => {
    if (ambient.brightness >= 1) {
      restoreSystemBrightness();
    } else {
      applyNativeBrightness(ambient.brightness);
    }
  }, [ambient.brightness]);

  const { idle, reset: resetIdleTimer } = useIdleTimer(ambient.idleMinutes * 60 * 1000, ambient.enabled);

  useEffect(() => {
    // Waits on the auth check first — there's nothing to hydrate from
    // Supabase until a household is signed in (see needsAuth above), and
    // hydrateAllStores() itself now guards against being called too early
    // too, but skipping the call entirely here avoids the console warning
    // on every normal boot.
    if (!authInitialized || needsAuth) return;

    // Pulls the family's data down from Supabase (or, if it isn't
    // configured, just leaves the in-memory seed data in place) and opens
    // the realtime subscriptions that keep this device in sync with any
    // other device signed into the same household. See
    // src/store/useAppStore.ts → "Supabase sync helpers".
    //
    // Each individual table fetch already times out on its own (see
    // fetchTable's FETCH_TIMEOUT_MS) — this is a second, outer backstop so
    // that even something unexpected getting stuck can never leave a
    // wall-mounted tablet parked on a spinner indefinitely.
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        setDataReady(true);
      }
    };
    const backstop = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('[app] Supabase hydration did not finish within 10s — showing the app anyway');
      finish();
    }, 10000);

    hydrateAllStores()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[app] initial Supabase hydration failed — continuing with seed data', err);
      })
      .finally(() => {
        clearTimeout(backstop);
        finish();
      });
  }, [authInitialized, needsAuth]);

  if (!fontsLoaded || !authInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }

  // No signed-in household (and Supabase is actually configured — see
  // needsAuth above) → show sign-in/sign-up instead of the loading spinner
  // or the app itself. This sits above the PIN lock: the PIN is this
  // household's day-to-day gate, but there's no household to gate into yet.
  if (needsAuth) {
    return <AuthScreen />;
  }

  if (!dataReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }

  // A PIN configured (Settings → App Lock) and this device not yet unlocked
  // for it → show the lock screen instead of the app. `unlocked` is
  // persisted per device (see useAppLockStore), so a device that's entered
  // the PIN before skips straight to the app; a new device/browser — or
  // anyone without the PIN — always starts locked. No PIN configured at all
  // means no gate.
  const locked = !!pinHash && !unlocked;
  const showAmbient = ambient.enabled && idle;

  return (
    // onTouchStart here is what the idle timer actually listens to on native
    // (web tracks mouse/keyboard/touch globally on its own — see
    // useIdleTimer). A touch anywhere, including on the screensaver itself
    // (rendered as a child below), bubbles up to this View and resets it.
    <View style={{ flex: 1 }} onTouchStart={resetIdleTimer}>
      {/* The sidebar (wide/desktop layout) lives inside RootNavigator, not
          here — it needs useNavigation()/useRoute(), which only work inside
          NavigationContainer. */}
      <UiScaleWrapper>{locked ? <LockScreen /> : <RootNavigator />}</UiScaleWrapper>
      {!locked && !showAmbient && <HuddleControls />}
      {showAmbient && <AmbientScreen />}
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
