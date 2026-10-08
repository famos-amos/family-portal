// The "Talk" voice button (internally still called Huddle — see the Gemini
// pipeline this calls into) — a pill next to the Settings gear, top-right.
// App.tsx mounts one global instance; press and hold to dictate calendar
// events, reminders, chore completions, shopping-list items, or meal-plan
// changes.
//
// Flow: press → record (pulsing mic + "Listening…") → release → stop →
// upload to huddle-voice (Gemini) → review screen listing each proposed
// action with its own Confirm/Reject → Done, or Try Again to re-record.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../theme/ThemeProvider';
import { notify } from '../lib/alerts';
import { analyzeHuddleRecording, applyVoiceAction, buildReviewableActions, ReviewableAction } from '../lib/huddleVoice';

type Phase = 'idle' | 'recording' | 'analyzing' | 'reviewing' | 'error';

export function HuddleButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reviewItems, setReviewItems] = useState<ReviewableAction[]>([]);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase !== 'recording') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 480, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const startRecording = async () => {
    if (phase !== 'idle') return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        notify('Microphone needed', 'Allow microphone access in your device settings to use Huddle.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (err: any) {
      notify('Could not start recording', String(err?.message ?? err));
    }
  };

  const stopAndAnalyze = async () => {
    if (phase !== 'recording') return;
    setPhase('analyzing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was captured — try holding the button a little longer.');
      const result = await analyzeHuddleRecording(uri);
      setTranscript(result.transcript);
      const reviewable = buildReviewableActions(result.actions);
      if (reviewable.length === 0) {
        notify(
          'Nothing to do',
          result.transcript ? `Heard: "${result.transcript}" — but no action was recognized.` : "Didn't catch anything actionable.",
        );
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

  const cancelRecording = async () => {
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
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

  const recording = phase === 'recording';
  const analyzing = phase === 'analyzing';

  return (
    <>
      {/* Positioning (top-right, next to the Settings gear) is owned by the
          HuddleControls wrapper that renders this alongside SnapButton — this
          pill is just a normal flex child here. */}
      <Pressable
        onPressIn={startRecording}
        onPressOut={stopAndAnalyze}
        disabled={analyzing || phase === 'reviewing'}
        style={[styles.fab, { backgroundColor: recording ? theme.colors.danger : theme.colors.ink }]}
      >
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          {analyzing ? <ActivityIndicator color={theme.colors.panel} size="small" /> : <Text style={styles.fabIcon}>🎙️</Text>}
        </Animated.View>
        <Text style={[styles.fabLabel, { color: theme.colors.panel }]}>
          {recording ? 'Listening…' : analyzing ? 'Thinking…' : 'Talk'}
        </Text>
      </Pressable>

      <Modal visible={phase === 'reviewing'} transparent animationType="fade" onRequestClose={tryAgain}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.panel }]}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.colors.ink, marginBottom: 4 }}>
              Here's what I heard
            </Text>
            {!!transcript && (
              <Text
                style={{ fontFamily: theme.fonts.body, fontStyle: 'italic', fontSize: 12.5, color: theme.colors.inkSoft, marginBottom: 14 }}
              >
                "{transcript}"
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
              Huddle couldn't process that
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

      {/* An explicit cancel target while recording — releasing the button
          normally stops+analyzes, but a slower long-press flow benefits from
          a visible "stop without sending" escape hatch too. */}
      {recording && (
        <Pressable onPress={cancelRecording} style={[styles.cancelHint, { top: insets.top + 64 }]}>
          <Text style={styles.cancelHintText}>Tap here to cancel</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // A pill next to the Settings gear (top-right) — positioning (top/right)
  // is owned by the HuddleControls wrapper, this is just the pill's own look.
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
  cancelHint: { position: 'absolute', right: 24, alignItems: 'center' },
  cancelHintText: { color: '#fff', fontSize: 11, backgroundColor: '#00000090', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 460, maxWidth: '92%', borderRadius: 24, padding: 22 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 8 },
  reviewBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});
