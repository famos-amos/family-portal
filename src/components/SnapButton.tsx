// The "Snap" button — a pill next to Talk, top-right. Takes a photo of a
// flyer/notice and asks Gemini (via the huddle-snap Edge Function) to read
// it and propose actions, reusing the exact same review flow and action
// types as the Talk/Huddle voice button (see huddleActions.ts).
//
// Flow: tap → open camera → snap a photo → upload to huddle-snap (Gemini) →
// review screen listing each proposed action with its own Confirm/Reject →
// Done, or Try Again to retake the photo.
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeProvider';
import { notify } from '../lib/alerts';
import { analyzeFlyerPhoto, applyVoiceAction, buildReviewableActions, ReviewableAction } from '../lib/huddleSnap';
import { WebCameraModal } from './WebCameraModal';

type Phase = 'idle' | 'capturing' | 'analyzing' | 'reviewing' | 'error';

export function SnapButton() {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [showWebCamera, setShowWebCamera] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewableAction[]>([]);
  const [summary, setSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const analyze = async (uri: string) => {
    setPhase('analyzing');
    try {
      const analysis = await analyzeFlyerPhoto(uri);
      setSummary(analysis.summary);
      const reviewable = buildReviewableActions(analysis.actions);
      if (reviewable.length === 0) {
        notify('Nothing to add', analysis.summary || "Didn't find anything actionable in that photo.");
        setPhase('idle');
        return;
      }
      setReviewItems(reviewable);
      setPhase('reviewing');
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err));
      setPhase('error');
    }
  };

  const captureAndAnalyze = async () => {
    if (phase !== 'idle') return;
    setPhase('capturing');

    // expo-image-picker's launchCameraAsync falls back to a plain file-upload
    // dialog on desktop web (the <input capture> attribute is only honored by
    // mobile browsers) — so on web, open a real live-camera view instead via
    // WebCameraModal (getUserMedia). Native (iOS/Android) always has a real
    // camera through launchCameraAsync.
    if (Platform.OS === 'web') {
      setShowWebCamera(true);
      return;
    }

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notify('Camera needed', 'Allow camera access in your device settings to use Snap.');
        setPhase('idle');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (result.canceled || result.assets.length === 0) {
        setPhase('idle');
        return;
      }
      await analyze(result.assets[0].uri);
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err));
      setPhase('error');
    }
  };

  const onWebCameraCapture = (uri: string) => {
    setShowWebCamera(false);
    analyze(uri);
  };
  const onWebCameraClose = () => {
    setShowWebCamera(false);
    setPhase('idle');
  };

  const confirmOne = (item: ReviewableAction) => {
    applyVoiceAction(item);
    setReviewItems((prev) => {
      const next = prev.filter((r) => r.id !== item.id);
      if (next.length === 0) setPhase('idle');
      return next;
    });
  };
  const rejectOne = (item: ReviewableAction) => {
    setReviewItems((prev) => {
      const next = prev.filter((r) => r.id !== item.id);
      if (next.length === 0) setPhase('idle');
      return next;
    });
  };
  const tryAgain = () => {
    setReviewItems([]);
    setErrorMsg('');
    setPhase('idle');
  };

  const busy = phase === 'capturing' || phase === 'analyzing';

  return (
    <>
      {/* Positioning (top-right, next to Talk) is owned by the
          HuddleControls wrapper that renders this alongside HuddleButton. */}
      <Pressable
        onPress={captureAndAnalyze}
        disabled={busy || phase === 'reviewing'}
        style={[styles.fab, { backgroundColor: theme.colors.ink }]}
      >
        {busy ? <ActivityIndicator color={theme.colors.panel} size="small" /> : <Text style={styles.fabIcon}>📷</Text>}
        <Text style={[styles.fabLabel, { color: theme.colors.panel }]}>
          {phase === 'capturing' ? 'Opening…' : phase === 'analyzing' ? 'Reading…' : 'Snap'}
        </Text>
      </Pressable>

      <WebCameraModal visible={showWebCamera} onCapture={onWebCameraCapture} onClose={onWebCameraClose} />

      <Modal visible={phase === 'reviewing'} transparent animationType="fade" onRequestClose={tryAgain}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink, marginBottom: 4 }}>
              Here's what I found
            </Text>
            {!!summary && (
              <Text
                style={{ fontFamily: theme.fonts.body, fontStyle: 'italic', fontSize: 12.5, color: theme.colors.inkSoft, marginBottom: 14 }}
              >
                "{summary}"
              </Text>
            )}
            <ScrollView style={{ maxHeight: 360 }}>
              {reviewItems.map((item) => (
                <View key={item.id} style={[styles.reviewRow, { backgroundColor: theme.colors.fieldBg }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fonts.bodySemiBold, fontSize: 13.5, color: theme.colors.ink }}>
                      {item.summary}
                    </Text>
                    {item.note && (
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.danger, marginTop: 3 }}>
                        {item.note}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => rejectOne(item)}
                      style={[styles.reviewBtn, { backgroundColor: theme.colors.border }]}
                    >
                      <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.inkSoft }}>
                        Reject
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmOne(item)}
                      disabled={!item.canApply}
                      style={[
                        styles.reviewBtn,
                        { backgroundColor: theme.colors.ink, opacity: item.canApply ? 1 : 0.4 },
                      ]}
                    >
                      <Text style={{ fontFamily: theme.fonts.headSemiBold, fontSize: 12, color: theme.colors.panel }}>Confirm</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={tryAgain} style={[styles.modalBtn, { backgroundColor: theme.colors.fieldBg }]}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Try Again</Text>
              </Pressable>
              <Pressable onPress={() => { setReviewItems([]); setPhase('idle'); }} style={[styles.modalBtn, { backgroundColor: theme.colors.ink }]}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.panel }}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={phase === 'error'} transparent animationType="fade" onRequestClose={tryAgain}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink, marginBottom: 8 }}>
              Snap couldn't process that
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.inkSoft, marginBottom: 16 }}>
              {errorMsg}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setPhase('idle')} style={[styles.modalBtn, { backgroundColor: theme.colors.fieldBg }]}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Close</Text>
              </Pressable>
              <Pressable onPress={tryAgain} style={[styles.modalBtn, { backgroundColor: theme.colors.ink }]}>
                <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.panel }}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // A pill next to Talk (top-right) — positioning (top/right) is owned by
  // the HuddleControls wrapper, this is just the pill's own look.
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabIcon: { fontSize: 17 },
  fabLabel: { fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 460, maxWidth: '92%', borderRadius: 24, padding: 22 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 8 },
  reviewBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});
