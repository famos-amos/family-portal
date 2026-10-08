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
import { useFamilyStore, useCalendarStore, useSettingsStore, useAppLockStore } from '../store/useAppStore';
import { hashPin, isValidPin, PIN_LENGTH } from '../lib/pin';
import { personColorOptions } from '../theme/colors';
import { FamilyMember, ThemePreference } from '../store/types';
import { confirmAction, notify } from '../lib/alerts';
import {
  exchangeGoogleCode,
  fetchGoogleCalendarList,
  fetchGoogleEvents,
  getFreshGoogleAccessToken,
  isGoogleConfigured,
  useGoogleAuthRequest,
} from '../lib/googleCalendar';
import {
  AppleCredentials,
  clearAppleCredentials,
  discoverCalendarHome,
  fetchAppleEvents,
  loadAppleCredentials,
  saveAppleCredentials,
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

export function SettingsScreen() {
  const theme = useTheme();
  const [section, setSection] = useState<SectionId>('family');
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
function AppearanceSection() {
  const theme = useTheme();
  const themePreference = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <View>
      <Text style={[styles.h1, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>Appearance</Text>
      <Text style={[styles.sub, { fontFamily: theme.fonts.body, color: theme.colors.inkSoft }]}>
        Choose how Huddle looks on this tablet.
      </Text>
      <View style={{ maxWidth: 420, marginTop: 6 }}>
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Connected Calendars
// ---------------------------------------------------------------------------
function ConnectedCalendarsSection() {
  const theme = useTheme();
  const google = useSettingsStore((s) => s.google);
  const setGoogleAuth = useSettingsStore((s) => s.setGoogleAuth);
  const disconnectGoogle = useSettingsStore((s) => s.disconnectGoogle);
  const apple = useSettingsStore((s) => s.apple);
  const setAppleConnection = useSettingsStore((s) => s.setAppleConnection);
  const setAppleEnabled = useSettingsStore((s) => s.setAppleEnabled);
  const subscribedCalendars = useSettingsStore((s) => s.subscribedCalendars);
  const replaceSyncedEvents = useCalendarStore((s) => s.replaceSyncedEvents);

  const googleConfigured = useMemo(() => isGoogleConfigured(), []);
  const [request, response, promptAsync] = useGoogleAuthRequest();
  const [googleBusy, setGoogleBusy] = useState(false);

  // Refresh the account's calendar list, then pull events from every calendar
  // in it and swap them into the app's calendar.
  const runGoogleSync = async (accessToken: string) => {
    const calendars = await fetchGoogleCalendarList(accessToken);
    setGoogleAuth({ calendars });
    const ids = calendars.length ? calendars.map((c) => c.id) : ['primary'];
    const events = await fetchGoogleEvents(accessToken, ids);
    replaceSyncedEvents(
      'google',
      events,
      ids.map((id) => `google:${id}`),
    );
    return events.length;
  };

  // "Sync Now" once already connected — no browser round-trip, just refresh
  // the access token from the stored refresh token if needed.
  const syncGoogleNow = async () => {
    setGoogleBusy(true);
    try {
      const count = await runGoogleSync(await getFreshGoogleAccessToken());
      notify('Google Calendar synced', `Synced ${count} upcoming event(s).`);
    } catch (err: any) {
      notify('Google Calendar sync failed', String(err?.message ?? err));
    } finally {
      setGoogleBusy(false);
    }
  };

  // Guards against redeeming the same one-time auth code twice — the effect
  // below runs again when `request` finishes loading after a web redirect.
  const handledAuthRef = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[google] auth response:', response?.type, response);

    if (!response) return;

    if (response.type === 'error') {
      notify('Google sign-in failed', response.error?.message ?? 'Please try again.');
      return;
    }
    if (response.type !== 'success') return; // dismiss / cancel / locked

    const authKey = response.params?.code ?? response.authentication?.accessToken ?? 'ok';
    if (handledAuthRef.current === authKey) return;

    // On web the code exchange needs `request` (for codeVerifier + redirectUri),
    // which can still be loading right after a redirect. Wait for the next run
    // (deps include `request`) instead of bailing for good.
    const haveNativeToken = !!response.authentication?.accessToken;
    if (!haveNativeToken && !request) return;

    handledAuthRef.current = authKey;

    (async () => {
      setGoogleBusy(true);
      try {
        let accessToken: string | undefined;
        if (response.authentication?.accessToken) {
          // Native: the provider already redeemed the code on-device.
          const a = response.authentication;
          accessToken = a.accessToken;
          setGoogleAuth({
            refreshToken: a.refreshToken ?? undefined,
            accessToken: a.accessToken,
            expiresAt: Date.now() + (a.expiresIn ?? 3600) * 1000,
          });
        } else if (response.params?.code && request) {
          // Web: redeem the code via the backend (holds the client secret).
          const t = await exchangeGoogleCode({
            code: response.params.code,
            codeVerifier: request.codeVerifier ?? '',
            redirectUri: request.redirectUri,
          });
          accessToken = t.accessToken;
          setGoogleAuth({
            refreshToken: t.refreshToken,
            accessToken: t.accessToken,
            expiresAt: t.expiresAt,
          });
        }

        if (!accessToken) {
          handledAuthRef.current = null;
          // eslint-disable-next-line no-console
          console.error('[google] success response but no token extracted', response);
          notify(
            'Google sign-in incomplete',
            'Signed in, but no access token came back. Check the console for the auth response shape.',
          );
          return;
        }

        // Authenticated now — reflect that in the UI regardless of whether the
        // first events pull works.
        setGoogleAuth({ connected: true });
        try {
          const count = await runGoogleSync(accessToken);
          notify('Google Calendar connected', `Synced ${count} upcoming event(s).`);
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
      } catch (err: any) {
        handledAuthRef.current = null;
        notify('Google sign-in failed', String(err?.message ?? err));
      } finally {
        setGoogleBusy(false);
      }
    })();
  }, [response, request]);

  const [appleId, setAppleId] = useState('');
  const [applePassword, setApplePassword] = useState('');
  const [appleBusy, setAppleBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadAppleCredentials();
      if (saved) setAppleId(saved.appleId);
    })();
  }, []);

  const connectApple = async () => {
    if (!appleId.trim() || !applePassword.trim()) {
      notify('Missing info', 'Enter your Apple ID and an app-specific password.');
      return;
    }
    const creds: AppleCredentials = { appleId: appleId.trim(), appSpecificPassword: applePassword.trim() };
    setAppleBusy(true);
    try {
      await saveAppleCredentials(creds);
      const home = await discoverCalendarHome(creds);
      const events = await fetchAppleEvents(creds, home);
      replaceSyncedEvents('apple', events);
      setAppleConnection(true, creds.appleId);
      setApplePassword('');
      notify('Apple Calendar connected', `Synced ${events.length} upcoming event(s).`);
    } catch (err: any) {
      notify(
        'Apple Calendar sync failed',
        `${String(err?.message ?? err)}\n\nApple/iCloud sync is a first draft and hasn't been verified against a real Apple ID yet — see README.md.`,
      );
    } finally {
      setAppleBusy(false);
    }
  };

  const disconnectApple = async () => {
    await clearAppleCredentials();
    setAppleConnection(false);
    setApplePassword('');
  };

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
        Two-way sync keeps Huddle's calendar and your family's Google/Apple calendars matching. Public
        calendars can be followed by link (view only).
      </Text>

      {/* Google */}
      <View style={[styles.calendarCard, { backgroundColor: theme.colors.fieldBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
            Google Calendar
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 2 }}>
            {!googleConfigured
              ? 'Needs a Google Cloud OAuth Client ID — see README.md "Google Calendar setup".'
              : google.connected
              ? `Connected${google.email ? ` as ${google.email}` : ''}.`
              : 'Not connected yet.'}
          </Text>
        </View>
        {googleConfigured ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {google.connected && (
              <>
                <Switch
                  value={google.enabled !== false}
                  onValueChange={(v) => setGoogleAuth({ enabled: v })}
                />
                <Pressable onPress={disconnectGoogle} disabled={googleBusy} hitSlop={6}>
                  <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.danger }}>
                    Disconnect
                  </Text>
                </Pressable>
              </>
            )}
            <PrimaryButton
              label={googleBusy ? 'Syncing…' : google.connected ? 'Sync Now' : 'Connect'}
              color={theme.colors.calDk}
              onPress={() => (google.connected ? syncGoogleNow() : promptAsync())}
            />
          </View>
        ) : (
          <View style={[styles.disabledPill, { backgroundColor: theme.colors.border }]}>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.inkSoft }}>
              Setup required
            </Text>
          </View>
        )}
      </View>
      {google.connected && google.enabled === false && (
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.inkSoft, marginTop: -6, marginBottom: 8 }}>
          Google events are hidden and local changes aren't pushed to Google while this is off.
        </Text>
      )}

      {/* Apple */}
      <View style={[styles.calendarCard, { flexDirection: 'column', alignItems: 'stretch', backgroundColor: theme.colors.fieldBg }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
              Apple / iCloud Calendar
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 2 }}>
              {Platform.OS === 'web'
                ? "Not available in the web version — iCloud's servers block browser requests (CORS). Use the tablet's Expo Go / installed app build instead."
                : apple.connected
                ? `Connected as ${apple.appleId}.`
                : 'Sign in with an app-specific password.'}
            </Text>
          </View>
          {apple.connected && Platform.OS !== 'web' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch value={apple.enabled !== false} onValueChange={setAppleEnabled} />
              <PrimaryButton label="Disconnect" color={theme.colors.danger} onPress={disconnectApple} />
            </View>
          )}
        </View>

        {!apple.connected && Platform.OS !== 'web' && (
          <View style={{ marginTop: 12, gap: 8 }}>
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
        )}
      </View>

      {/* Public calendars (view only) */}
      <View style={[styles.calendarCard, { flexDirection: 'column', alignItems: 'stretch', backgroundColor: theme.colors.fieldBg }]}>
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>
          Public calendars
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.inkSoft, marginTop: 2 }}>
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
