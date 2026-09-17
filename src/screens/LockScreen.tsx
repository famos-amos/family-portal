// Full-screen PIN gate shown by App.tsx whenever a PIN is configured
// (useAppLockStore.pinHash) and this device hasn't unlocked yet. Not a
// navigator screen — App.tsx swaps it in for the whole RootNavigator, so
// there's nothing to "go back" to from here.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAppLockStore } from '../store/useAppStore';
import { hashPin, PIN_LENGTH } from '../lib/pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function LockScreen() {
  const theme = useTheme();
  const pinHash = useAppLockStore((s) => s.pinHash);
  const unlock = useAppLockStore((s) => s.unlock);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async (candidate: string) => {
    setChecking(true);
    const hash = await hashPin(candidate);
    setChecking(false);
    if (hash === pinHash) {
      unlock();
    } else {
      setError(true);
      setDigits('');
    }
  };

  const press = (key: string) => {
    if (checking || !key) return;
    if (key === 'del') {
      setDigits((d) => d.slice(0, -1));
      setError(false);
      return;
    }
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setDigits(next);
    setError(false);
    if (next.length === PIN_LENGTH) submit(next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 24, color: theme.colors.ink, marginBottom: 6 }}>
        Family Portal
      </Text>
      <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.inkSoft, marginBottom: 26 }}>
        Enter the PIN to continue
      </Text>

      <View style={styles.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < digits.length;
          const color = error ? theme.colors.danger : theme.colors.ink;
          return (
            <View
              key={i}
              style={[styles.dot, { borderColor: color }, filled && { backgroundColor: color }]}
            />
          );
        })}
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.bodyBold,
          fontSize: 12,
          color: theme.colors.danger,
          marginTop: 12,
          height: 16,
          opacity: error ? 1 : 0,
        }}
      >
        Incorrect PIN
      </Text>

      <View style={styles.keypad}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(k)}
              disabled={checking}
              style={[styles.key, { backgroundColor: theme.colors.panel }]}
            >
              <Text
                style={{
                  fontFamily: k === 'del' ? theme.fonts.headSemiBold : theme.fonts.head,
                  fontSize: k === 'del' ? 15 : 24,
                  color: theme.colors.ink,
                }}
              >
                {k === 'del' ? '⌫' : k}
              </Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  keypad: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    justifyContent: 'center',
    gap: 16,
  },
  key: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
