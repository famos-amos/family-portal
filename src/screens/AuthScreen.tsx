// Full-screen sign-in/sign-up gate shown by App.tsx whenever there's no
// active Supabase Auth session — see useAuthStore (src/store/useAppStore.ts)
// and migrate_v8.sql. This sits ABOVE the PIN lock (LockScreen): signing in
// here is a one-time "which family is this device for" step (the session
// persists), while the PIN stays the quick everyday gate underneath it,
// now scoped to whichever household just signed in.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/useAppStore';
import { PrimaryButton } from '../components/ui';

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const theme = useTheme();
  const signUp = useAuthStore((s) => s.signUp);
  const signIn = useAuthStore((s) => s.signIn);

  const [mode, setMode] = useState<Mode>('signIn');
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
    <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.panel, borderColor: theme.colors.border }]}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 24, color: theme.colors.ink, marginBottom: 6 }}>
          Huddle
        </Text>

        {signedUp ? (
          <>
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.ink, marginBottom: 8 }}>
              Check your email
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft, lineHeight: 19 }}>
              We sent a confirmation link to {email.trim()} — open it on this device to finish setting up your
              family's Huddle.
            </Text>
          </>
        ) : (
          <>
            <Text
              style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.inkSoft, marginBottom: 22 }}
            >
              {mode === 'signIn' ? 'Sign in to your family’s Huddle' : 'Create your family’s Huddle'}
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
              color={theme.colors.ink}
            />

            <Pressable
              onPress={() => {
                setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
                setError('');
              }}
              style={styles.switchModeBtn}
            >
              <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 12.5, color: theme.colors.inkSoft }}>
                {mode === 'signIn' ? "New family? Create one instead" : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: 360, maxWidth: '100%', borderRadius: 24, borderWidth: 1.5, padding: 24 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  switchModeBtn: { marginTop: 14, alignItems: 'center' },
});
