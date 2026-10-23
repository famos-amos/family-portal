import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TopBar } from '../components/TopBar';
import { Avatar } from '../components/Avatar';
import { useTheme } from '../theme/ThemeProvider';
import { PrimaryButton, SegmentedControl, Switch } from '../components/ui';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import {
  useFamilyStore,
  useCalendarStore,
  useSettingsStore,
  useAppLockStore,
  useAuthStore,
  useProviderSyncStatusStore,
} from '../store/useAppStore';
import { hashPin, isValidPin, PIN_LENGTH } from '../lib/pin';
import { personColorOptions } from '../theme/colors';
import { AppleAccount, FamilyMember, GoogleAccount, PaletteSeed, ThemePreference } from '../store/types';
import { CUSTOM_SWATCH_OPTIONS, PALETTE_PRESETS, paletteSwatchDots } from '../lib/paletteColors';
import { confirmAction, notify } from '../lib/alerts';
import {
  consumeWebRedirectAuthResult,
  exchangeGoogleCode,
  fetchGoogleUserEmail,
  isGoogleConfigured,
  startWebRedirectAuth,
  syncGoogleAccount,
  useGoogleAuthRequest,
} from '../lib/googleCalendar';
import {
  AppleCredentials,
  clearAppleCredentials,
  saveAppleCredentials,
  syncAppleAccount,
} from '../lib/appleCalendar';
import {
  addSubscribedCalendarFromLink,
  removeSubscribedCalendarWithEvents,
  toggleSubscribedCalendarWithRefresh,
} from '../lib/icsCalendar';
import { AmbientScreen } from './AmbientScreen';
import { AMBIENT_CATEGORIES } from '../data/ambientBackgrounds';
import { AmbientPhoto, listAmbientPhotos, pickAndUploadAmbientPhotos, removeAmbientPhoto } from '../lib/ambientPhotos';
import { geocodeLocation } from '../lib/weather';
import { WeatherLocation } from '../store/types';
import { contrastText } from '../lib/contrastColor';
import { useSettingsDirtyStore, watchForSettingsChanges } from '../lib/settingsDirty';

type SectionId = 'family' | 'appearance' | 'calendars' | 'screensaver' | 'notifications' | 'security' | 'about';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'family', label: 'Family Members' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'calendars', label: 'Connected Calendars' },
  { id: 'screensaver', label: 'Screensaver' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'App Lock' },
  { id: 'about', label: 'About' },
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Google's redirect back after web sign-in (see startWebRedirectAuth /
// consumeWebRedirectAuthResult in googleCalendar.ts) lands here with a
// `code` or `error` query param — but the section that actually consumes it
// (ConnectedCalendarsSection, under "Calendars") only mounts when that tab
// is selected, and "Family" is the default. Without this, returning from
// Google would silently sit unprocessed until the family member happened to
// click over to Calendars themselves.
function initialSettingsSection(): SectionId {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'family';
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error') ? 'calendars' : 'family';
}

export function SettingsScreen() {
  const theme = useTheme();
  const [section, setSection] = useState<SectionId>(initialSettingsSection);
  const dirty = useSettingsDirtyStore((s) => s.dirty);
  const markSaved = useSettingsDirtyStore((s) => s.markSaved);

  // Watches every store a Settings section can edit (see settingsDirty.ts)
  // for the lifetime of this screen, regardless of which section is
  // currently showing — so the Save bar below is correct "on all the
  // settings pages", not just the one you happened to edit on.
  useEffect(() => watchForSettingsChanges(), []);

  const handleSave = () => {
    markSaved();
    notify('Saved', 'Your changes have been saved.');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <TopBar />
      <View style={[styles.saveBar, { backgroundColor: theme.colors.panel }]}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, flex: 1 }}>
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!dirty}
          style={[styles.saveBtn, { backgroundColor: theme.colors.ink, opacity: dirty ? 1 : 0.35 }]}
        >
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: contrastText(theme.colors.ink) }}>Save</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={[styles.sidebar, { backgroundColor: theme.colors.panel }]}>
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSection(s.id)}
                style={[
                  styles.sideItem,
                  active && { backgroundColor: theme.isDark ? '#FFFFFF14' : theme.colors.fieldBg },
                ]}
              >
                <Text
                  style={{
                    fontFamily: active ? theme.fonts.headSemiBold : theme.fonts.bodySemiBold,
                    fontSize: 14,
                    color: active ? theme.colors.ink : theme.colors.inkSoft,
                  }}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={styles.detail} contentContainerStyle={styles.detailContent}>
          {section === 'family' && <FamilyMembersSection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'calendars' && <ConnectedCalendarsSection />}
          {section === 'screensaver' && <ScreensaverSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'security' && <AppLockSection />}
          {section === 'about' && <AboutSection />}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Family Members
// ---------------------------------------------------------------------------
function FamilyMembersSection() {
  const theme = useTheme();
  const members = useFamilyStore((s) => s.members);
  const updateMember = useFamilyStore((s) => s.updateMember);
  const removeMember = useFamilyStore((s) => s.removeMember);
  const addMember = useFamilyStore((s) => s.addMember);

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Family Members</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        Names, birthdays and colors here are used across the calendar, chores and meal plans instead of showing
        anyone's real name to us.
      </Text>

      {members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          onChange={(patch) => updateMember(m.id, patch)}
          onRemove={() =>
            confirmAction(
              'Remove family member?',
              `This will remove "${m.name}" and unassign their items.`,
              'Remove',
              () => removeMember(m.id),
              { destructive: true },
            )
          }
        />
      ))}

      <PrimaryButton
        label="Add Family Member"
        color={theme.colors.ink}
        icon={PlusIcon}
        onPress={() => {
          const name = 'New Member';
          addMember({
            name,
            initials: initialsFor(name),
            color: personColorOptions[members.length % personColorOptions.length],
            birthday: undefined,
          });
        }}
      />
    </View>
  );
}

function MemberRow({
  member,
  onChange,
  onRemove,
}: {
  member: FamilyMember;
  onChange: (patch: Partial<Omit<FamilyMember, 'id'>>) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [birthday, setBirthday] = useState(member.birthday ?? '');

  useEffect(() => {
    setName(member.name);
    setBirthday(member.birthday ?? '');
  }, [member.name, member.birthday]);

  const commit = () => {
    const trimmedName = name.trim() || member.name;
    onChange({ name: trimmedName, initials: initialsFor(trimmedName), birthday: birthday.trim() || undefined });
    setEditing(false);
  };

  return (
    <View style={[styles.memberCard, { backgroundColor: theme.colors.fieldBg }]}>
      <Avatar initials={member.initials} color={member.color} size={40} />

      <View style={{ flex: 1, gap: 6 }}>
        {editing ? (
          <>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={theme.colors.inkSoft}
              style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
            />
            <TextInput
              value={birthday}
              onChangeText={setBirthday}
              placeholder="Birthday (YYYY-MM-DD)"
              placeholderTextColor={theme.colors.inkSoft}
              style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
            />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {personColorOptions.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => onChange({ color: c })}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    member.color === c && { borderWidth: 3, borderColor: theme.colors.ink },
                  ]}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
              {member.name}
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft }}>
              {member.birthday ? `Birthday: ${member.birthday}` : 'No birthday set'}
            </Text>
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => (editing ? commit() : setEditing(true))}
          style={[styles.iconBtn, { backgroundColor: theme.colors.panel }]}
        >
          {editing ? (
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.success }}>
              Save
            </Text>
          ) : (
            <EditIcon size={16} color={theme.colors.inkSoft} />
          )}
        </Pressable>
        <Pressable onPress={onRemove} style={[styles.iconBtn, { backgroundColor: theme.colors.panel }]}>
          <TrashIcon size={16} color={theme.colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------
const UI_SCALE_STEPS = [0.9, 1, 1.1, 1.2, 1.3];

function AppearanceSection() {
  const theme = useTheme();
  const themePreference = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const paletteId = useSettingsStore((s) => s.paletteId);
  const setPaletteId = useSettingsStore((s) => s.setPaletteId);
  const customPaletteSeed = useSettingsStore((s) => s.customPaletteSeed);
  const setCustomPaletteColor = useSettingsStore((s) => s.setCustomPaletteColor);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const setUiScale = useSettingsStore((s) => s.setUiScale);

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Appearance</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        Choose how Huddle looks on this tablet.
      </Text>
      <View style={{ maxWidth: 420, marginTop: 6, marginBottom: 24 }}>
        <SegmentedControl<ThemePreference>
          value={themePreference}
          onChange={setTheme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </View>

      <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>
        Color Theme
      </Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.inkSoft, marginBottom: 12 }}>
        Picks the colors for Calendar, Meals, Chores, Boards and Verse — separate from Light/Dark above.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {PALETTE_PRESETS.map((preset) => (
          <PaletteOptionCard
            key={preset.id}
            label={preset.label}
            dots={paletteSwatchDots(preset.id, customPaletteSeed)}
            active={paletteId === preset.id}
            onPress={() => setPaletteId(preset.id)}
          />
        ))}
        <PaletteOptionCard
          label="Custom"
          dots={paletteSwatchDots('custom', customPaletteSeed)}
          active={paletteId === 'custom'}
          onPress={() => setPaletteId('custom')}
        />
      </View>

      {paletteId === 'custom' && (
        <View style={[styles.customPaletteBox, { backgroundColor: theme.colors.fieldBg }]}>
          {CUSTOM_PALETTE_FIELDS.map((field) => (
            <View key={field.key} style={{ marginBottom: 14 }}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.ink, marginBottom: 8 }}>
                {field.label}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {CUSTOM_SWATCH_OPTIONS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCustomPaletteColor(field.key, c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      customPaletteSeed[field.key] === c && { borderWidth: 3, borderColor: theme.colors.ink },
                    ]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>
        Size
      </Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.inkSoft, marginBottom: 12 }}>
        Zooms the whole app — larger fonts and bigger cards, handy for reading from across the room.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {UI_SCALE_STEPS.map((step) => {
          const active = Math.abs(uiScale - step) < 0.01;
          return (
            <Pressable
              key={step}
              onPress={() => setUiScale(step)}
              style={[
                styles.scaleStep,
                { backgroundColor: theme.colors.fieldBg, borderColor: active ? theme.colors.ink : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: active ? theme.fonts.headSemiBold : theme.fonts.bodySemiBold,
                  fontSize: 13,
                  color: active ? theme.colors.ink : theme.colors.inkSoft,
                }}
              >
                {Math.round(step * 100)}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CUSTOM_PALETTE_FIELDS: { key: keyof PaletteSeed; label: string }[] = [
  { key: 'cal', label: 'Calendar' },
  { key: 'meal', label: 'Meals' },
  { key: 'chores', label: 'Chores' },
  { key: 'boards', label: 'Boards' },
  { key: 'verse', label: 'Verse' },
  { key: 'accent', label: 'Accent (sidebar + buttons)' },
];

function PaletteOptionCard({
  label,
  dots,
  active,
  onPress,
}: {
  label: string;
  dots: string[];
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.paletteCard,
        { backgroundColor: theme.colors.fieldBg, borderColor: active ? theme.colors.ink : 'transparent' },
      ]}
    >
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
        {dots.map((d, i) => (
          <View key={i} style={[styles.paletteDot, { backgroundColor: d }]} />
        ))}
      </View>
      <Text
        style={{
          fontFamily: active ? theme.fonts.headSemiBold : theme.fonts.bodySemiBold,
          fontSize: 12.5,
          color: active ? theme.colors.ink : theme.colors.inkSoft,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Connected Calendars
// ---------------------------------------------------------------------------
function ConnectedCalendarsSection() {
  const theme = useTheme();
  const googleAccounts = useSettingsStore((s) => s.googleAccounts);
  const addGoogleAccount = useSettingsStore((s) => s.addGoogleAccount);
  const updateGoogleAccount = useSettingsStore((s) => s.updateGoogleAccount);
  const removeGoogleAccount = useSettingsStore((s) => s.removeGoogleAccount);
  const appleAccounts = useSettingsStore((s) => s.appleAccounts);
  const addAppleAccount = useSettingsStore((s) => s.addAppleAccount);
  const updateAppleAccount = useSettingsStore((s) => s.updateAppleAccount);
  const removeAppleAccount = useSettingsStore((s) => s.removeAppleAccount);
  const subscribedCalendars = useSettingsStore((s) => s.subscribedCalendars);

  const googleConfigured = useMemo(() => isGoogleConfigured(), []);
  const [request, response, promptAsync] = useGoogleAuthRequest();
  const [googleConnecting, setGoogleConnecting] = useState(false);

  // Shared tail end of a successful OAuth round-trip, however the tokens
  // were obtained (native's on-device code exchange, or either of the two
  // web paths below) — looks up whether this is an already-connected
  // account reconnecting (matched by email) or a brand new one, then runs
  // its first sync.
  const finishGoogleConnect = async (tokens: { accessToken: string; refreshToken?: string; expiresAt: number }) => {
    const email = await fetchGoogleUserEmail(tokens.accessToken).catch(() => '');
    const existing = email ? useSettingsStore.getState().googleAccounts.find((a) => a.email === email) : undefined;
    let accountId: string;
    if (existing) {
      updateGoogleAccount(existing.id, { email, enabled: true, ...tokens });
      accountId = existing.id;
    } else {
      accountId = addGoogleAccount({ email, enabled: true, ...tokens }).id;
    }
    try {
      const count = await syncGoogleAccount(accountId);
      notify(existing ? 'Google account reconnected' : 'Google account connected', `Synced ${count} upcoming event(s).`);
    } catch (syncErr: any) {
      // eslint-disable-next-line no-console
      console.error('[google] initial events sync failed —', syncErr);
      notify(
        'Connected, but the first sync failed',
        `${String(syncErr?.message ?? syncErr)}\n\nMost often this means the Google Calendar API ` +
          'is not enabled on the project, or the calendar.events scope was not granted on the ' +
          'OAuth consent screen. Fix that, then tap Sync Now.',
      );
    }
  };

  // Web sign-in picks back up here after Google redirects back to this page
  // (see startWebRedirectAuth / consumeWebRedirectAuthResult's header
  // comment in googleCalendar.ts for why this replaced the popup flow).
  // Runs once on mount — if there's nothing to consume (e.g. a normal page
  // load, not a return from Google), this is a no-op.
  useEffect(() => {
    const result = consumeWebRedirectAuthResult();
    if (!result) return;
    if (result.type === 'error') {
      notify('Google sign-in failed', result.message);
      return;
    }
    // Must be the EXACT string actually sent to Google in step 1, not
    // something re-derived from the browser's current address bar — proven
    // live on this project's real OAuth client: GitHub Pages 301-redirects
    // the no-trailing-slash URL Google was given to a slash-terminated one,
    // so by the time this page reloads, window.location has a trailing
    // slash that was never actually part of the original request. Sending
    // that mismatched slash to Google's token endpoint is exactly what
    // caused the redirect_uri_mismatch error here. originalRedirectUri is
    // the one startWebRedirectAuth stashed before leaving for Google, so
    // it's guaranteed to be identical regardless of any redirect in between.
    const redirectUri = result.originalRedirectUri ?? `${window.location.origin}${window.location.pathname}`;
    (async () => {
      setGoogleConnecting(true);
      try {
        const t = await exchangeGoogleCode({ code: result.code, codeVerifier: result.codeVerifier, redirectUri });
        await finishGoogleConnect(t);
      } catch (err: any) {
        notify('Google sign-in failed', `${String(err?.message ?? err)}\n\nredirectUri used: ${redirectUri}`);
      } finally {
        setGoogleConnecting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native only — the provider auto-exchanges the code on-device
  // (shouldAutoExchangeCode is true there), so `response.authentication`
  // already has a usable token. Web no longer uses `promptAsync`/`response`
  // at all (see the redirect-based effect above), so this never fires there.
  const handledAuthRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      notify('Google sign-in failed', response.error?.message ?? 'Please try again.');
      return;
    }
    if (response.type !== 'success' || !response.authentication?.accessToken) return;

    const authKey = response.authentication.accessToken;
    if (handledAuthRef.current === authKey) return;
    handledAuthRef.current = authKey;

    (async () => {
      setGoogleConnecting(true);
      try {
        const a = response.authentication!;
        await finishGoogleConnect({
          accessToken: a.accessToken,
          refreshToken: a.refreshToken ?? undefined,
          expiresAt: Date.now() + (a.expiresIn ?? 3600) * 1000,
        });
      } catch (err: any) {
        handledAuthRef.current = null;
        notify('Google sign-in failed', String(err?.message ?? err));
      } finally {
        setGoogleConnecting(false);
      }
    })();
  }, [response]);

  const startGoogleConnect = () => {
    if (Platform.OS === 'web') {
      if (!request) {
        notify('Still loading', 'Give it a moment and try again.');
        return;
      }
      startWebRedirectAuth(request);
    } else {
      promptAsync();
    }
  };

  const syncOneGoogleAccount = async (account: GoogleAccount) => {
    try {
      const count = await syncGoogleAccount(account.id);
      notify('Google Calendar synced', `Synced ${count} upcoming event(s) for ${account.email}.`);
    } catch (err: any) {
      notify('Google Calendar sync failed', String(err?.message ?? err));
    }
  };

  const disconnectGoogleAccount = (account: GoogleAccount) =>
    confirmAction(
      'Disconnect this Google account?',
      `Stops syncing new changes for ${account.email || 'this account'}. Events already synced stay until the next full sync or reset.`,
      'Disconnect',
      () => removeGoogleAccount(account.id),
      { destructive: true },
    );

  // --- Apple / iCloud — see appleCalendar.ts; credentials are kept out of
  // this (persisted) store, per account, in secure storage.
  const [appleId, setAppleId] = useState('');
  const [applePassword, setApplePassword] = useState('');
  const [appleBusy, setAppleBusy] = useState(false);

  const connectApple = async () => {
    if (!appleId.trim() || !applePassword.trim()) {
      notify('Missing info', 'Enter your Apple ID and an app-specific password.');
      return;
    }
    const creds: AppleCredentials = { appleId: appleId.trim(), appSpecificPassword: applePassword.trim() };
    const existing = appleAccounts.find((a) => a.appleId === creds.appleId);
    setAppleBusy(true);
    try {
      const accountId = existing ? existing.id : addAppleAccount({ appleId: creds.appleId, enabled: true }).id;
      if (existing) updateAppleAccount(existing.id, { enabled: true });
      await saveAppleCredentials(accountId, creds);
      const count = await syncAppleAccount(accountId);
      setAppleId('');
      setApplePassword('');
      notify(existing ? 'Apple account reconnected' : 'Apple account connected', `Synced ${count} upcoming event(s).`);
    } catch (err: any) {
      notify(
        'Apple Calendar sync failed',
        `${String(err?.message ?? err)}\n\nApple/iCloud sync is a first draft and hasn't been verified against a real Apple ID yet — see README.md.`,
      );
    } finally {
      setAppleBusy(false);
    }
  };

  const syncOneAppleAccount = async (account: AppleAccount) => {
    try {
      const count = await syncAppleAccount(account.id);
      notify('Apple Calendar synced', `Synced ${count} upcoming event(s) for ${account.appleId}.`);
    } catch (err: any) {
      notify('Apple Calendar sync failed', String(err?.message ?? err));
    }
  };

  const disconnectAppleAccount = (account: AppleAccount) =>
    confirmAction(
      'Disconnect this Apple ID?',
      `Stops syncing new changes for ${account.appleId}. Events already synced stay until the next full sync or reset.`,
      'Disconnect',
      async () => {
        await clearAppleCredentials(account.id);
        removeAppleAccount(account.id);
      },
      { destructive: true },
    );

  // --- Public (subscribed) calendars — shares the same helpers the Calendar
  // screen's toolbar uses (add/toggle/remove live in src/lib/icsCalendar).
  const [subName, setSubName] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [subBusy, setSubBusy] = useState(false);

  const addPublicCalendar = async () => {
    if (!subName.trim() || !subUrl.trim()) {
      notify('Missing info', 'Enter a name and an ICS / webcal URL.');
      return;
    }
    const name = subName.trim();
    setSubName('');
    setSubUrl('');
    setSubBusy(true);
    try {
      const { count } = await addSubscribedCalendarFromLink(name, subUrl);
      notify('Calendar added', `Loaded ${count} event(s) from "${name}".`);
    } catch (err: any) {
      notify('Added, but could not load it', String(err?.message ?? err));
    } finally {
      setSubBusy(false);
    }
  };

  const removePublicCalendar = (id: string, name: string) =>
    confirmAction(
      'Remove calendar?',
      `Stop following "${name}" and remove its events?`,
      'Remove',
      () => removeSubscribedCalendarWithEvents(id),
      { destructive: true },
    );

  const toggleAndMaybeRefresh = (id: string) => {
    void toggleSubscribedCalendarWithRefresh(id);
  };

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Connected Calendars</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        Two-way sync keeps Huddle's calendar and your family's Google/Apple calendars matching — connect as many
        accounts as your family uses. Public calendars can be followed by link (view only).
      </Text>

      {/* Google — one row per connected account, then "add another" */}
      <Text style={[styles.providerLabel, { color: theme.colors.inkSoft }]}>Google</Text>
      {!googleConfigured ? (
        <View style={[styles.calendarCard, { backgroundColor: theme.colors.fieldBg }]}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, flex: 1 }}>
            Needs a Google Cloud OAuth Client ID — see README.md "Google Calendar setup".
          </Text>
          <View style={[styles.disabledPill, { backgroundColor: theme.colors.border }]}>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.inkSoft }}>
              Setup required
            </Text>
          </View>
        </View>
      ) : (
        <>
          {googleAccounts.map((account) => (
            <GoogleAccountRow
              key={account.id}
              account={account}
              onToggle={(enabled) => updateGoogleAccount(account.id, { enabled })}
              onSync={() => syncOneGoogleAccount(account)}
              onDisconnect={() => disconnectGoogleAccount(account)}
            />
          ))}
          <PrimaryButton
            label={googleConnecting ? 'Connecting…' : googleAccounts.length ? '+ Add another Google account' : 'Connect Google Calendar'}
            color={theme.colors.calDk}
            onPress={startGoogleConnect}
          />
        </>
      )}

      {/* Apple / iCloud — same shape as Google above */}
      <Text style={[styles.providerLabel, { color: theme.colors.inkSoft, marginTop: 18 }]}>Apple / iCloud</Text>
      {Platform.OS === 'web' ? (
        <View style={[styles.calendarCard, { backgroundColor: theme.colors.fieldBg }]}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, flex: 1 }}>
            Not available in the web version — iCloud's servers block browser requests (CORS). Use the tablet's
            Expo Go / installed app build instead.
          </Text>
        </View>
      ) : (
        <>
          {appleAccounts.map((account) => (
            <AppleAccountRow
              key={account.id}
              account={account}
              onToggle={(enabled) => updateAppleAccount(account.id, { enabled })}
              onSync={() => syncOneAppleAccount(account)}
              onDisconnect={() => disconnectAppleAccount(account)}
            />
          ))}
          <View style={[styles.calendarCard, { flexDirection: 'column', alignItems: 'stretch', backgroundColor: theme.colors.fieldBg }]}>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 14, color: theme.colors.ink, marginBottom: 8 }}>
              {appleAccounts.length ? '+ Add another Apple ID' : 'Connect an Apple ID'}
            </Text>
            <View style={{ gap: 8 }}>
              <TextInput
                value={appleId}
                onChangeText={setAppleId}
                placeholder="Apple ID email"
                autoCapitalize="none"
                placeholderTextColor={theme.colors.inkSoft}
                style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
              />
              <TextInput
                value={applePassword}
                onChangeText={setApplePassword}
                placeholder="App-specific password"
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor={theme.colors.inkSoft}
                style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
              />
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.inkSoft }}>
                Generate one at appleid.apple.com → Sign-In and Security → App-Specific Passwords. Never use your
                real Apple ID password here.
              </Text>
              <PrimaryButton
                label={appleBusy ? 'Connecting…' : 'Connect'}
                color={theme.colors.ink}
                onPress={connectApple}
              />
            </View>
          </View>
        </>
      )}

      {/* Public calendars (view only) */}
      <Text style={[styles.providerLabel, { color: theme.colors.inkSoft, marginTop: 18 }]}>Public calendars</Text>
      <View style={[styles.calendarCard, { flexDirection: 'column', alignItems: 'stretch', backgroundColor: theme.colors.fieldBg }]}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft }}>
          Follow any calendar by its ICS or webcal link (e.g. a school, sports team, or a Google
          calendar's "public address in iCal format"). View only — these events can't be edited here.
        </Text>

        {subscribedCalendars.length > 0 && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {subscribedCalendars.map((c) => (
              <View
                key={c.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.ink }}>
                    {c.name}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.inkSoft }}>
                    {c.url}
                  </Text>
                </View>
                <Switch value={c.enabled} onValueChange={() => toggleAndMaybeRefresh(c.id)} />
                <Pressable onPress={() => removePublicCalendar(c.id, c.name)} hitSlop={8}>
                  <TrashIcon size={16} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 12, gap: 8 }}>
          <TextInput
            value={subName}
            onChangeText={setSubName}
            placeholder="Calendar name (e.g. Neighborhood)"
            placeholderTextColor={theme.colors.inkSoft}
            style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
          />
          <TextInput
            value={subUrl}
            onChangeText={setSubUrl}
            placeholder="https://…/basic.ics  or  webcal://…"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={theme.colors.inkSoft}
            style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
          />
          <PrimaryButton
            label={subBusy ? 'Loading…' : 'Add calendar'}
            color={theme.colors.calDk}
            icon={PlusIcon}
            onPress={addPublicCalendar}
          />
        </View>
      </View>
    </View>
  );
}

/** One connected Google account's row — email, enabled switch, Sync Now
 * (tracking useProviderSyncStatusStore for a spinner/last-synced/error
 * label), Disconnect. Mirrors AppleAccountRow below. */
function GoogleAccountRow({
  account,
  onToggle,
  onSync,
  onDisconnect,
}: {
  account: GoogleAccount;
  onToggle: (enabled: boolean) => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const theme = useTheme();
  const status = useProviderSyncStatusStore((s) => s.google[account.id]);
  const syncing = status?.state === 'syncing';
  return (
    <View style={[styles.calendarCard, { backgroundColor: theme.colors.fieldBg }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
          {account.email || 'Google account'}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 }}>
          {syncStatusLabel(status)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Switch value={account.enabled} onValueChange={onToggle} />
        <Pressable onPress={onDisconnect} disabled={syncing} hitSlop={6}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.danger }}>
            Disconnect
          </Text>
        </Pressable>
        <PrimaryButton label={syncing ? 'Syncing…' : 'Sync Now'} color={theme.colors.calDk} onPress={onSync} />
      </View>
    </View>
  );
}

/** One connected Apple account's row — same shape as GoogleAccountRow. */
function AppleAccountRow({
  account,
  onToggle,
  onSync,
  onDisconnect,
}: {
  account: AppleAccount;
  onToggle: (enabled: boolean) => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const theme = useTheme();
  const status = useProviderSyncStatusStore((s) => s.apple[account.id]);
  const syncing = status?.state === 'syncing';
  return (
    <View style={[styles.calendarCard, { backgroundColor: theme.colors.fieldBg }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
          {account.appleId}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 }}>
          {syncStatusLabel(status)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Switch value={account.enabled} onValueChange={onToggle} />
        <Pressable onPress={onDisconnect} disabled={syncing} hitSlop={6}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.danger }}>
            Disconnect
          </Text>
        </Pressable>
        <PrimaryButton label={syncing ? 'Syncing…' : 'Sync Now'} color={theme.colors.ink} onPress={onSync} />
      </View>
    </View>
  );
}

/** Shared "Connected." / "Synced 2m ago." / "Sync failed — tap Sync Now to
 * retry." line for both account row types, from useProviderSyncStatusStore. */
function syncStatusLabel(status: { state: 'idle' | 'syncing' | 'ok' | 'error'; message?: string; at?: string } | undefined): string {
  if (!status || status.state === 'idle') return 'Connected.';
  if (status.state === 'syncing') return 'Syncing…';
  if (status.state === 'error') return `Sync failed — ${status.message ?? 'tap Sync Now to retry.'}`;
  return 'Synced just now.';
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
function NotificationsSection() {
  const theme = useTheme();
  const notifications = useSettingsStore((s) => s.notifications);
  const setNotification = useSettingsStore((s) => s.setNotification);

  const rows: { key: 'chores' | 'events' | 'daily'; label: string; desc: string }[] = [
    { key: 'chores', label: 'Chore reminders', desc: 'Nudge when a chore is due or newly assigned.' },
    { key: 'events', label: 'Calendar events', desc: 'Alerts for upcoming family events.' },
    { key: 'daily', label: 'Daily Challenge & Verse', desc: 'A morning nudge for the daily card on the dashboard.' },
  ];

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Notifications</Text>
      {rows.map((r) => (
        <View key={r.key} style={[styles.notifRow, { backgroundColor: theme.colors.fieldBg }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 14.5, color: theme.colors.ink }}>
              {r.label}
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 }}>
              {r.desc}
            </Text>
          </View>
          <Switch value={notifications[r.key]} onValueChange={(v) => setNotification(r.key, v)} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screensaver — ambient slideshow (own photos or a curated category), idle
// delay, transition timing/order, optional clock + weather overlay, and
// in-app brightness. See AmbientScreen.tsx (the actual full-screen display,
// shown by App.tsx) and src/data/ambientBackgrounds.ts.
// ---------------------------------------------------------------------------
const IDLE_PRESETS_MIN = [1, 3, 5, 10, 15, 30];
const TRANSITION_PRESETS_MIN = [1, 5, 10, 15, 30, 60];
const BRIGHTNESS_STEPS = [0.25, 0.4, 0.55, 0.7, 0.85, 1];

function ScreensaverSection() {
  const theme = useTheme();
  const ambient = useSettingsStore((s) => s.ambient);
  const setAmbient = useSettingsStore((s) => s.setAmbient);
  const [previewing, setPreviewing] = useState(false);

  const [photos, setPhotos] = useState<AmbientPhoto[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [locationQuery, setLocationQuery] = useState(ambient.weatherLocation?.label ?? '');
  const [locationResults, setLocationResults] = useState<WeatherLocation[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const refreshPhotos = async () => {
    setPhotosBusy(true);
    try {
      setPhotos(await listAmbientPhotos());
    } finally {
      setPhotosBusy(false);
    }
  };

  useEffect(() => {
    if (ambient.enabled && ambient.source === 'photos') refreshPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient.enabled, ambient.source]);

  const addPhotos = async () => {
    try {
      const n = await pickAndUploadAmbientPhotos();
      if (n > 0) {
        notify('Photos added', `Uploaded ${n} photo(s).`);
        refreshPhotos();
      }
    } catch (err: any) {
      notify('Could not add photos', String(err?.message ?? err));
    }
  };

  const deletePhoto = (photo: AmbientPhoto) => {
    confirmAction(
      'Remove this photo?',
      'It will no longer appear in the screensaver.',
      'Remove',
      async () => {
        try {
          await removeAmbientPhoto(photo.path);
          refreshPhotos();
        } catch (err: any) {
          notify('Could not remove photo', String(err?.message ?? err));
        }
      },
      { destructive: true },
    );
  };

  const searchLocation = async () => {
    if (!locationQuery.trim()) return;
    setSearchingLocation(true);
    try {
      setLocationResults(await geocodeLocation(locationQuery.trim()));
    } finally {
      setSearchingLocation(false);
    }
  };

  const pill = (active: boolean) => [
    styles.disabledPill,
    {
      backgroundColor: active ? theme.colors.ink : theme.colors.fieldBg,
      marginRight: 8,
      marginBottom: 8,
    },
  ];
  const pillText = (active: boolean) => ({
    fontFamily: theme.fonts.headSemiBold,
    fontSize: 12.5,
    color: active ? contrastText(theme.colors.ink) : theme.colors.inkSoft,
  });

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Screensaver</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        After a while with no touches, the screen fades into a warm photo slideshow instead of just going
        dark — a real screensaver, not the device turning off.
      </Text>

      <View style={[styles.notifRow, { backgroundColor: theme.colors.fieldBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 14.5, color: theme.colors.ink }}>
            Enable screensaver
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 }}>
            Shows after the idle delay below.
          </Text>
        </View>
        <Pressable onPress={() => setPreviewing(true)} style={[styles.previewBtn, { backgroundColor: theme.colors.fieldBg, borderColor: theme.colors.ink }]}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.ink }}>Preview</Text>
        </Pressable>
        <Switch value={ambient.enabled} onValueChange={(v) => setAmbient({ enabled: v })} />
      </View>

      <Modal visible={previewing} animationType="fade" onRequestClose={() => setPreviewing(false)}>
        {/* Tapping anywhere dismisses it — the touch bubbles up to this
            plain View, same mechanism the real screensaver uses in App.tsx
            (see useIdleTimer's comment) rather than a visible close button
            getting in the way of seeing the actual slideshow. */}
        <View style={{ flex: 1 }} onTouchStart={() => setPreviewing(false)}>
          <AmbientScreen />
          <View style={styles.previewHint} pointerEvents="none">
            <Text style={styles.previewHintText}>Tap anywhere to close preview</Text>
          </View>
        </View>
      </Modal>

      {ambient.enabled && (
        <>
          <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>Show after</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {IDLE_PRESETS_MIN.map((m) => (
              <Pressable key={m} onPress={() => setAmbient({ idleMinutes: m })} style={pill(ambient.idleMinutes === m)}>
                <Text style={pillText(ambient.idleMinutes === m)}>{m} min</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>Background source</Text>
          <View style={{ maxWidth: 420, marginBottom: 14 }}>
            <SegmentedControl
              value={ambient.source}
              onChange={(v) => setAmbient({ source: v })}
              options={[
                { value: 'curated', label: 'Curated Art' },
                { value: 'photos', label: 'My Photos' },
              ]}
            />
          </View>

          {ambient.source === 'curated' ? (
            <View style={{ marginBottom: 14 }}>
              {AMBIENT_CATEGORIES.map((c) => {
                const active = ambient.curatedCategoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setAmbient({ curatedCategoryId: c.id })}
                    style={[
                      styles.notifRow,
                      {
                        backgroundColor: active ? theme.colors.ink : theme.colors.fieldBg,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    <Image source={{ uri: c.photos[0] }} style={styles.categoryThumb} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: theme.fonts.headSemiBold,
                          fontSize: 14,
                          color: active ? contrastText(theme.colors.ink) : theme.colors.ink,
                        }}
                      >
                        {c.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: theme.fonts.body,
                          fontSize: 11.5,
                          color: active ? contrastText(theme.colors.ink) + 'CC' : theme.colors.inkSoft,
                          marginTop: 2,
                        }}
                      >
                        {c.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.inkSoft, marginTop: 2 }}>
                Starter photo sets — see src/data/ambientBackgrounds.ts to swap in your own picks.
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 14 }}>
              <PrimaryButton
                label={photosBusy ? 'Working…' : 'Add Photos'}
                color={theme.colors.ink}
                icon={PlusIcon}
                onPress={addPhotos}
              />
              {photos.length === 0 ? (
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 10 }}>
                  No photos uploaded yet — add some to use them in the slideshow. They're stored in your
                  Supabase project, so they show up on every device, not just this one.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                  {photos.map((p) => (
                    <View key={p.path} style={styles.photoThumbWrap}>
                      <Image source={{ uri: p.url }} style={styles.photoThumb} />
                      <Pressable
                        onPress={() => deletePhoto(p)}
                        style={[styles.photoThumbDelete, { backgroundColor: theme.colors.danger }]}
                        hitSlop={6}
                      >
                        <TrashIcon size={12} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>Change photo every</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TRANSITION_PRESETS_MIN.map((m) => (
              <Pressable
                key={m}
                onPress={() => setAmbient({ transitionMinutes: m })}
                style={pill(ambient.transitionMinutes === m)}
              >
                <Text style={pillText(ambient.transitionMinutes === m)}>{m} min</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>Order</Text>
          <View style={{ maxWidth: 320, marginBottom: 14 }}>
            <SegmentedControl
              value={ambient.transitionStyle}
              onChange={(v) => setAmbient({ transitionStyle: v })}
              options={[
                { value: 'random', label: 'Random' },
                { value: 'sequential', label: 'In order' },
              ]}
            />
          </View>

          <View style={[styles.notifRow, { backgroundColor: theme.colors.fieldBg }]}>
            <Text style={{ flex: 1, fontFamily: theme.fonts.headSemiBold, fontSize: 14, color: theme.colors.ink }}>
              Show time on photos
            </Text>
            <Switch value={ambient.showClock} onValueChange={(v) => setAmbient({ showClock: v })} />
          </View>
          <View style={[styles.notifRow, { backgroundColor: theme.colors.fieldBg }]}>
            <Text style={{ flex: 1, fontFamily: theme.fonts.headSemiBold, fontSize: 14, color: theme.colors.ink }}>
              Show weather on photos
            </Text>
            <Switch value={ambient.showWeather} onValueChange={(v) => setAmbient({ showWeather: v })} />
          </View>

          {ambient.showWeather && (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={locationQuery}
                  onChangeText={setLocationQuery}
                  placeholder="City, state, or ZIP"
                  placeholderTextColor={theme.colors.inkSoft}
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
                  onSubmitEditing={searchLocation}
                />
                <PrimaryButton
                  label={searchingLocation ? 'Searching…' : 'Search'}
                  color={theme.colors.ink}
                  onPress={searchLocation}
                />
              </View>
              {locationResults.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {locationResults.map((r) => (
                    <Pressable
                      key={`${r.lat},${r.lon}`}
                      onPress={() => {
                        setAmbient({ weatherLocation: r });
                        setLocationQuery(r.label);
                        setLocationResults([]);
                      }}
                      style={[styles.notifRow, { backgroundColor: theme.colors.fieldBg, marginBottom: 6 }]}
                    >
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.ink }}>
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {ambient.weatherLocation && locationResults.length === 0 && (
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 8 }}>
                  Current location: {ambient.weatherLocation.label}
                </Text>
              )}
            </View>
          )}

          <Text style={[styles.fieldLabel, { fontFamily: theme.fonts.bodyBold, color: theme.colors.inkSoft }]}>Brightness</Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.inkSoft, marginBottom: 8 }}>
            Applies whenever the app is open, not just on the screensaver — handy with no physical
            brightness button.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {BRIGHTNESS_STEPS.map((b) => {
              const active = Math.abs(ambient.brightness - b) < 0.01;
              return (
                <Pressable
                  key={b}
                  onPress={() => setAmbient({ brightness: b })}
                  style={[
                    styles.brightnessStep,
                    { backgroundColor: `rgba(255,200,120,${b})` },
                    active && { borderWidth: 3, borderColor: theme.colors.ink },
                  ]}
                />
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// App Lock — a single shared PIN, stored (hashed) in Supabase, required to
// open the app. See src/lib/pin.ts and useAppLockStore in useAppStore.ts.
// ---------------------------------------------------------------------------
function AppLockSection() {
  const theme = useTheme();
  const pinHash = useAppLockStore((s) => s.pinHash);
  const setPin = useAppLockStore((s) => s.setPin);
  const clearPin = useAppLockStore((s) => s.clearPin);
  const lock = useAppLockStore((s) => s.lock);

  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);

  const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH);

  const save = async () => {
    if (!isValidPin(pin1)) {
      notify('Invalid PIN', `Enter a ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    if (pin1 !== pin2) {
      notify("PINs don't match", 'Re-enter the same PIN in both boxes.');
      return;
    }
    setBusy(true);
    try {
      await setPin(await hashPin(pin1));
      setPin1('');
      setPin2('');
      notify(
        pinHash ? 'PIN updated' : 'PIN set',
        'This device stays unlocked. Other devices (or anyone without the PIN) will be asked for it the next time they open the app.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    confirmAction(
      'Remove the PIN?',
      'Anyone who opens this app — on any device — will get straight in with no PIN.',
      'Remove',
      async () => {
        await clearPin();
        notify('PIN removed', 'The portal no longer requires a PIN.');
      },
      { destructive: true },
    );
  };

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>App Lock</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        Require a {PIN_LENGTH}-digit PIN to open Family Portal. One PIN, shared by everyone — only its hash
        is stored in Supabase, never the PIN itself. A device that's entered it stays unlocked; a brand-new
        device, browser, or anyone without the PIN always has to clear the lock screen first.
      </Text>

      <View style={[styles.calendarCard, { backgroundColor: theme.colors.fieldBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
            {pinHash ? 'A PIN is set' : 'No PIN set'}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 2 }}>
            {pinHash
              ? 'This device is unlocked. Locking it will show the PIN screen next.'
              : 'Anyone who opens the app gets straight in.'}
          </Text>
        </View>
        {pinHash && <PrimaryButton label="Lock this device" color={theme.colors.danger} onPress={lock} />}
      </View>

      <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.ink, marginTop: 8, marginBottom: 8 }}>
        {pinHash ? 'Change PIN' : 'Set a PIN'}
      </Text>
      <TextInput
        value={pin1}
        onChangeText={(v) => setPin1(digitsOnly(v))}
        placeholder={`New ${PIN_LENGTH}-digit PIN`}
        placeholderTextColor={theme.colors.inkSoft}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
      />
      <TextInput
        value={pin2}
        onChangeText={(v) => setPin2(digitsOnly(v))}
        placeholder="Confirm PIN"
        placeholderTextColor={theme.colors.inkSoft}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        style={[styles.input, { backgroundColor: theme.colors.panel, color: theme.colors.ink }]}
      />
      <PrimaryButton
        label={busy ? 'Saving…' : pinHash ? 'Update PIN' : 'Set PIN'}
        color={theme.colors.ink}
        onPress={save}
      />

      {pinHash && (
        <Pressable onPress={remove} style={{ marginTop: 14 }} hitSlop={6}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: theme.colors.danger }}>
            Remove PIN
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------
function AboutSection() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>About Huddle</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        Huddle is a shared family dashboard for a wall-mounted tablet: calendar, chores, meal plans and family
        boards in one warm, playful home screen.
      </Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 10 }}>
        Version 0.1.0 (local build)
      </Text>

      {user && (
        <View style={[styles.memberCard, { backgroundColor: theme.colors.fieldBg, marginTop: 22 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13.5, color: theme.colors.ink }}>
              Signed in
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 }}>
              {user.email}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              confirmAction(
                'Sign out?',
                'You’ll need your email and password to sign back in on this device.',
                'Sign Out',
                signOut,
                { destructive: true },
              )
            }
            style={[styles.saveBtn, { backgroundColor: theme.colors.danger }]}
          >
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13, color: contrastText(theme.colors.danger) }}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  body: { flex: 1, flexDirection: 'row', paddingHorizontal: 24, gap: 18, paddingBottom: 24 },
  sidebar: { width: 210, borderRadius: 20, padding: 10, gap: 4 },
  sideItem: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  detail: { flex: 1 },
  detailContent: { paddingBottom: 40, gap: 4 },
  h1: { fontSize: 20, marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 16, maxWidth: 560 },
  fieldLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4, marginBottom: 8 },
  categoryThumb: { width: 56, height: 56, borderRadius: 10 },
  photoThumbWrap: { width: 110, height: 90, borderRadius: 10, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoThumbDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightnessStep: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  paletteCard: { width: 108, padding: 12, borderRadius: 14, borderWidth: 2 },
  paletteDot: { width: 14, height: 14, borderRadius: 7 },
  customPaletteBox: { borderRadius: 14, padding: 16, marginBottom: 24 },
  scaleStep: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
  previewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, marginRight: 10 },
  previewHint: { position: 'absolute', top: 24, alignSelf: 'center' },
  previewHintText: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: '#00000090',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  providerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  disabledPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
});
