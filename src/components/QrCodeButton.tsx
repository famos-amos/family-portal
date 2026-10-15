// Small icon button next to Snap/Talk (top-right) — opens a modal with a QR
// code for this exact page, so someone can scan it with their phone and land
// on the same Huddle, already responsive to the phone's narrower width (see
// NARROW_BREAKPOINT) — there's no separate "mobile build" to link to.
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/ThemeProvider';
import { QrCodeIcon } from './icons';

// window.location is the live, always-correct source on web (same trick
// already used for the Google OAuth redirect in SettingsScreen.tsx) — this
// keeps working even if the site ever moves to a custom domain. Native has
// no window, so it falls back to the one known deployed URL.
function getAppUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return 'https://famos-amos.github.io/family-portal/';
}

export function QrCodeButton() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const url = getAppUrl();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.btn, { backgroundColor: theme.colors.ink }]}
        accessibilityLabel="Show a QR code to open Huddle on a phone"
      >
        <QrCodeIcon size={17} color={theme.colors.panel} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: theme.colors.panel }]}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink, marginBottom: 4 }}>
              Scan to open on your phone
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 12.5,
                color: theme.colors.inkSoft,
                textAlign: 'center',
                marginBottom: 18,
              }}
            >
              Point your phone's camera at this code — it opens this same Huddle.
            </Text>
            {/* Always a plain white card regardless of app theme — QR scanners
                need strong contrast and a quiet zone, not a dark-mode tint. */}
            <View style={styles.qrWrap}>
              <QRCode value={url} size={200} />
            </View>
            <Text
              numberOfLines={1}
              style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 11, color: theme.colors.inkSoft, marginTop: 14 }}
            >
              {url}
            </Text>
            <Pressable onPress={() => setOpen(false)} style={[styles.closeBtn, { backgroundColor: theme.colors.ink }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.panel }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  card: { width: 320, maxWidth: '90%', borderRadius: 24, padding: 24, alignItems: 'center' },
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 16 },
  closeBtn: { marginTop: 18, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999 },
});
