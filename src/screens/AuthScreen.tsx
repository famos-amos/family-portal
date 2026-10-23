// Full-screen landing page + sign-in/sign-up gate shown by App.tsx whenever
// there's no active Supabase Auth session — see useAuthStore
// (src/store/useAppStore.ts) and migrate_v8.sql. This sits ABOVE the PIN
// lock (LockScreen): signing in here is a one-time "which family is this
// device for" step (the session persists), while the PIN stays the quick
// everyday gate underneath it, now scoped to whichever household just
// signed in.
//
// Doubles as the marketing page for the app — previewed and approved as a
// standalone design before being built here (see the "Huddle Landing Page"
// artifact from that review) — so the same screen that explains what Huddle
// does is also where someone actually creates or signs into their family's
// account, rather than a separate splash page in front of a bare form.
import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/useAppStore';
import { PrimaryButton } from '../components/ui';
import {
  BoardsIcon,
  CalendarIcon,
  ChoresIcon,
  DevicesIcon,
  ImageIcon,
  MealIcon,
  MicIcon,
  PaletteIcon,
  QuestionIcon,
} from '../components/icons';

type Mode = 'signIn' | 'signUp';

// Below this, the hero's two columns and the 3-column feature grid stack to
// a single column instead — a marketing-page breakpoint, not the app's own
// NARROW_BREAKPOINT (tuned for the dashboard grid, a different layout).
const LANDING_BREAKPOINT = 860;

export function AuthScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < LANDING_BREAKPOINT;
  const scrollRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<Mode>('signIn');

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <NavBar mode={mode} onSetMode={setMode} />
      <HeroSection narrow={narrow} mode={mode} onSetMode={setMode} />
      <FeaturesSection narrow={narrow} />
      <MockupSection narrow={narrow} />
      <CtaBand
        onPress={() => {
          setMode('signUp');
          scrollToTop();
        }}
      />
      <Footer />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
function NavBar({ mode, onSetMode }: { mode: Mode; onSetMode: (m: Mode) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.nav, { backgroundColor: theme.colors.bg, borderBottomColor: theme.colors.border }]}>
      <View style={styles.navBrand}>
        <Image source={require('../../assets/icons/huddle-logo.png')} style={styles.navLogo} resizeMode="contain" />
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.colors.ink }}>Huddle</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => onSetMode('signIn')}
          style={[styles.navBtn, { borderWidth: 1.5, borderColor: theme.colors.border }]}
        >
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13.5, color: theme.colors.ink }}>
            Sign In
          </Text>
        </Pressable>
        <Pressable onPress={() => onSetMode('signUp')} style={[styles.navBtn, { backgroundColor: theme.colors.accent }]}>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 13.5, color: '#fff' }}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
function HeroSection({
  narrow,
  mode,
  onSetMode,
}: {
  narrow: boolean;
  mode: Mode;
  onSetMode: (m: Mode) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.hero, narrow && { flexDirection: 'column' }]}>
      <View style={{ flex: narrow ? undefined : 1.15, maxWidth: narrow ? undefined : 520 }}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent, fontFamily: theme.fonts.headSemiBold }]}>
          For the whole family
        </Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: narrow ? 36 : 48, color: theme.colors.ink, lineHeight: narrow ? 42 : 52, marginBottom: 20 }}>
          Your daily huddle, gracefully simplified.
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.inkSoft, lineHeight: 25, marginBottom: 28, maxWidth: 460 }}>
          One warm, shared home screen for your family's calendar, chores, meals and to-dos — on the kitchen
          tablet, or right in your pocket. Just talk to it, or snap a photo of a flyer, and Huddle figures out
          the rest.
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          <PrimaryButton label="Create Your Family" onPress={() => onSetMode('signUp')} color={theme.colors.accent} />
          <Pressable
            onPress={() => onSetMode('signIn')}
            style={[styles.ghostBtnLg, { borderColor: theme.colors.border }]}
          >
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>Sign In</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 22, flexWrap: 'wrap' }}>
          {['Free to start', 'Works on tablet & phone', 'Your data, your family only'].map((t) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.success }} />
              <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 12.5, color: theme.colors.inkSoft }}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flex: narrow ? undefined : 1, maxWidth: narrow ? undefined : 400, marginTop: narrow ? 36 : 0 }}>
        <AuthCard mode={mode} onSetMode={onSetMode} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The actual functional sign-in/sign-up form — same logic the original bare
// AuthScreen had, just restyled to sit inside the hero instead of alone in
// the middle of the screen.
function AuthCard({ mode, onSetMode }: { mode: Mode; onSetMode: (m: Mode) => void }) {
  const theme = useTheme();
  const signUp = useAuthStore((s) => s.signUp);
  const signIn = useAuthStore((s) => s.signIn);

  const [householdName, setHouseholdName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signedUp, setSignedUp] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (mode === 'signUp' && password.length < 6) {
      setError('Password needs to be at least 6 characters.');
      return;
    }
    setBusy(true);
    const result =
      mode === 'signUp'
        ? await signUp(trimmedEmail, password, householdName.trim() || 'My Family')
        : await signIn(trimmedEmail, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === 'signUp') setSignedUp(true);
  };

  return (
    <View style={[styles.authCard, { backgroundColor: theme.colors.panel, borderColor: theme.colors.border }]}>
      {signedUp ? (
        <>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 19, color: theme.colors.ink, marginBottom: 8 }}>
            Check your email
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft, lineHeight: 19 }}>
            We sent a confirmation link to {email.trim()} — open it on this device to finish setting up your
            family's Huddle.
          </Text>
        </>
      ) : (
        <>
          <View style={[styles.tabRow, { backgroundColor: theme.colors.fieldBg }]}>
            <Pressable
              onPress={() => {
                onSetMode('signIn');
                setError('');
              }}
              style={[styles.tabBtn, mode === 'signIn' && { backgroundColor: theme.colors.panel }]}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.headSemiBold,
                  fontSize: 13,
                  color: mode === 'signIn' ? theme.colors.ink : theme.colors.inkSoft,
                }}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onSetMode('signUp');
                setError('');
              }}
              style={[styles.tabBtn, mode === 'signUp' && { backgroundColor: theme.colors.panel }]}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.headSemiBold,
                  fontSize: 13,
                  color: mode === 'signUp' ? theme.colors.ink : theme.colors.inkSoft,
                }}
              >
                Create Family
              </Text>
            </Pressable>
          </View>

          <Text style={{ fontFamily: theme.fonts.head, fontSize: 19, color: theme.colors.ink, marginBottom: 4 }}>
            {mode === 'signIn' ? 'Welcome back' : "Create your family's Huddle"}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft, marginBottom: 18 }}>
            {mode === 'signIn' ? "Sign in to your family's Huddle." : 'Takes about a minute. Free to start.'}
          </Text>

          {mode === 'signUp' && (
            <TextInput
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder="Family name (e.g. The Smiths)"
              placeholderTextColor={theme.colors.inkSoft}
              style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.colors.inkSoft}
            secureTextEntry
            style={[styles.input, { backgroundColor: theme.colors.fieldBg, color: theme.colors.ink }]}
          />

          {!!error && (
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 12, color: theme.colors.danger, marginBottom: 10 }}>
              {error}
            </Text>
          )}

          <PrimaryButton
            label={busy ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Family'}
            onPress={submit}
            color={mode === 'signIn' ? theme.colors.ink : theme.colors.accent}
          />
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
type Feature = { Icon: React.ComponentType<{ size?: number; color?: string }>; tint: string; iconColor: string; title: string; body: string };

function FeaturesSection({ narrow }: { narrow: boolean }) {
  const theme = useTheme();
  const features: Feature[] = [
    { Icon: CalendarIcon, tint: theme.colors.calBg, iconColor: theme.colors.calDk, title: 'Shared Calendar', body: 'Sync Google or Apple calendars, subscribe to any public calendar, and see everyone’s day color-coded in one view.' },
    { Icon: ChoresIcon, tint: theme.colors.choresBg, iconColor: '#3E8A52', title: 'Chores & Rewards', body: 'Points, progress rings, and a weekly tally for every kid — chores that actually feel like a game.' },
    { Icon: MealIcon, tint: theme.colors.mealBg, iconColor: theme.colors.mealDk, title: 'Meal Planning', body: "Yesterday, tonight, and tomorrow's dinner at a glance, plus a recipe box the whole family can pull from." },
    { Icon: BoardsIcon, tint: theme.colors.boardsBg, iconColor: theme.colors.boardsDk, title: 'Family Boards', body: 'To-dos, wishlists, and the shopping list — organized into boards everyone can add to.' },
    { Icon: MicIcon, tint: theme.colors.accentBg, iconColor: theme.colors.accent, title: 'Talk & Snap', body: 'Say "add milk to the list" or snap a photo of a flyer — Huddle turns it into the right event, chore, or reminder.' },
    { Icon: QuestionIcon, tint: theme.colors.verseBg, iconColor: '#7B5FA0', title: 'Daily Challenge & Verse', body: 'A fun family prompt and a daily verse — a small, shared moment every morning.' },
    { Icon: ImageIcon, tint: theme.colors.choresWeekBg, iconColor: '#8A6A3A', title: 'Ambient Screensaver', body: 'Family photos, the clock, and the weather — a gentle slideshow when nobody’s around.' },
    { Icon: PaletteIcon, tint: theme.colors.boardsBg, iconColor: theme.colors.boardsDk, title: 'Make It Yours', body: 'Color themes, a custom palette, zoom for easy reading from across the room, light or dark.' },
    { Icon: DevicesIcon, tint: theme.colors.calBg, iconColor: theme.colors.calDk, title: 'On Every Screen', body: 'A wall-mounted tablet at home, or scan the QR code and pull it up on your phone — same huddle, everywhere.' },
  ];

  return (
    <View style={styles.section}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent, fontFamily: theme.fonts.headSemiBold, textAlign: 'center' }]}>
          Everything in one place
        </Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 30, color: theme.colors.ink, textAlign: 'center', marginBottom: 10, maxWidth: 560 }}>
          Built for the way families actually run
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.colors.inkSoft, textAlign: 'center', maxWidth: 480, lineHeight: 21 }}>
          No more sticky notes, group texts, or "wait, whose turn is it?" — just one shared huddle everyone can see.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {features.map((f) => (
          <View
            key={f.title}
            style={[
              styles.featureCard,
              { backgroundColor: theme.colors.panel, borderColor: theme.colors.border, width: narrow ? '100%' : '31%', minWidth: narrow ? undefined : 280 },
            ]}
          >
            <View style={[styles.featureIconWrap, { backgroundColor: f.tint }]}>
              <f.Icon size={22} color={f.iconColor} />
            </View>
            <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 16, color: theme.colors.ink, marginBottom: 7 }}>
              {f.title}
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft, lineHeight: 19 }}>
              {f.body}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// A static, hand-built recreation of the real dashboard's look (same card +
// shaded-header-bar treatment as HomeScreen/widgets.tsx) with placeholder
// example data — not live data, since there's no signed-in household yet.
function MockupSection({ narrow }: { narrow: boolean }) {
  const theme = useTheme();
  const people = [
    { name: 'Alex', color: '#D98CA6', done: '3/4' },
    { name: 'Jamie', color: '#5FB8A8', done: '2/3' },
    { name: 'Mom', color: '#7FA8D9', done: '5/5' },
    { name: 'Dad', color: '#E3A94C', done: '2/4' },
  ];

  const MiniCard = ({ title, tint, children }: { title: string; tint: string; children: React.ReactNode }) => (
    <View style={[styles.mockCard, { backgroundColor: theme.colors.panel, borderColor: theme.colors.border }]}>
      <View style={[styles.mockCardHeader, { backgroundColor: tint }]}>
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.ink }}>{title}</Text>
      </View>
      <View style={{ padding: 12 }}>{children}</View>
    </View>
  );

  return (
    <View style={[styles.section, { paddingTop: 10 }]}>
      <View style={{ alignItems: 'center', marginBottom: 36 }}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent, fontFamily: theme.fonts.headSemiBold }]}>See it in action</Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.ink, textAlign: 'center', maxWidth: 520 }}>
          The home screen your family actually checks
        </Text>
      </View>

      <View style={[styles.mockFrame, { backgroundColor: theme.colors.panel, borderColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: theme.colors.ink }}>Huddle</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.inkSoft }}>
              Monday · October 20, 2026
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 10 }}>
          <View style={{ flex: narrow ? undefined : 1.4 }}>
            <MiniCard title="Calendar" tint={theme.colors.calBg}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, color: theme.colors.inkSoft, textAlign: 'center', marginBottom: 6 }}>
                October 2026
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: i === 14 ? theme.colors.calBg : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 8, color: theme.colors.inkSoft }}>{i + 1}</Text>
                  </View>
                ))}
              </View>
            </MiniCard>
          </View>

          <View style={{ flex: 1, gap: 10 }}>
            <MiniCard title="Today's Events" tint={theme.colors.calBg}>
              {[['9:00 AM', 'Soccer practice'], ['3:30 PM', 'Dentist'], ['6:00 PM', 'Family dinner']].map(([t, e]) => (
                <View key={e} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: 10.5, color: theme.colors.inkSoft, width: 54 }}>{t}</Text>
                  <Text style={{ fontSize: 10.5, color: theme.colors.ink }}>{e}</Text>
                </View>
              ))}
            </MiniCard>
            <MiniCard title="To Do" tint={theme.colors.boardsBg}>
              <Text style={{ fontSize: 10.5, color: theme.colors.ink, marginBottom: 6 }}>☐ Return package</Text>
              <Text style={{ fontSize: 10.5, color: theme.colors.inkSoft, textDecorationLine: 'line-through' }}>☑ Fix the faucet</Text>
            </MiniCard>
          </View>

          <View style={{ flex: 1, gap: 10 }}>
            <MiniCard title="Verse of the Day" tint={theme.colors.verseBg}>
              <Text style={{ fontSize: 10, fontStyle: 'italic', color: theme.colors.inkSoft }}>
                "Many hands make light work."
              </Text>
            </MiniCard>
            <MiniCard title="Meal Plan" tint={theme.colors.mealBg}>
              <Text style={{ fontSize: 9.5, color: theme.colors.inkSoft }}>Tonight</Text>
              <Text style={{ fontSize: 13, fontFamily: theme.fonts.headSemiBold, color: theme.colors.ink }}>Taco Night</Text>
            </MiniCard>
            <MiniCard title="Daily Challenge" tint={theme.colors.boardsBg}>
              <Text style={{ fontSize: 10, color: theme.colors.inkSoft }}>Window seat or aisle?</Text>
            </MiniCard>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <MiniCard title="Chores" tint={theme.colors.choresWeekBg}>
            <View style={{ flexDirection: 'row', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              {people.map((p) => (
                <View key={p.name} style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: theme.fonts.headSemiBold, color: p.color }}>{p.name}</Text>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      borderWidth: 4,
                      borderColor: p.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontFamily: theme.fonts.headSemiBold, color: theme.colors.ink }}>{p.done}</Text>
                  </View>
                </View>
              ))}
            </View>
          </MiniCard>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
function CtaBand({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.ctaBand, { backgroundColor: theme.colors.accent }]}>
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 28, color: '#fff', textAlign: 'center', marginBottom: 12 }}>
        Ready for your family's huddle?
      </Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 14.5, color: '#FDEAE0', textAlign: 'center', marginBottom: 24 }}>
        Free to get started — set it up in a few minutes.
      </Text>
      <Pressable onPress={onPress} style={styles.ctaBtn}>
        <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.accent }}>
          Create Your Family
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
function Footer() {
  const theme = useTheme();
  return (
    <View style={[styles.footer, { backgroundColor: theme.colors.choresWeekBg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image source={require('../../assets/icons/huddle-logo-dark.png')} style={styles.footerLogo} resizeMode="contain" />
        <View>
          <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 15, color: theme.colors.ink }}>Huddle</Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.inkSoft }}>
            Your daily huddle, gracefully simplified.
          </Text>
        </View>
      </View>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.inkSoft }}>
        © 2026 Huddle. Made for family.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  navLogo: { width: 30, height: 23 },
  navBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  hero: {
    flexDirection: 'row',
    gap: 48,
    paddingHorizontal: 40,
    paddingTop: 56,
    paddingBottom: 40,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { fontSize: 12.5, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12 },
  ghostBtnLg: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  authCard: { borderRadius: 24, borderWidth: 1.5, padding: 24 },
  tabRow: { flexDirection: 'row', borderRadius: 999, padding: 4, marginBottom: 20, gap: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  section: { paddingHorizontal: 40, paddingVertical: 56, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  featureCard: { padding: 22, borderRadius: 18, borderWidth: 1.5 },
  featureIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  mockFrame: { borderRadius: 24, borderWidth: 1.5, padding: 16, maxWidth: 860, width: '100%', alignSelf: 'center' },
  mockCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  mockCardHeader: { paddingHorizontal: 12, paddingVertical: 8 },
  ctaBand: { paddingHorizontal: 40, paddingVertical: 60, alignItems: 'center' },
  ctaBtn: { backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  footer: {
    paddingHorizontal: 40,
    paddingVertical: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  footerLogo: { width: 24, height: 18 },
});
