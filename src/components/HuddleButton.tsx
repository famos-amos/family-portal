// The "Talk" voice button (internally still called Huddle — see the Gemini
// pipeline this calls into) — a pill next to the Settings gear, top-right.
// App.tsx mounts one global instance; tap once to start, then explicitly
// Cancel or Done from the overlay — see the flow note on RECORDING_TIMEOUT_MS
// below for why this isn't press-and-hold any more.
//
// Flow: tap → record (pulsing mic + "Listening…", Cancel/Done buttons) →
// Done (or the 30s auto-timeout) → stop → "Thinking…" → upload to
// huddle-voice (Gemini) → review screen listing each proposed action with
// its own Confirm/Reject → Done, or Try Again to re-record. Cancel at any
// point during recording discards the clip and returns straight to idle —
// no upload, no action taken.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../theme/ThemeProvider';
import { notify } from '../lib/alerts';
import { analyzeHuddleRecording, applyVoiceAction, buildReviewableActions, ReviewableAction } from '../lib/huddleVoice';

type Phase = 'idle' | 'recording' | 'analyzing' | 'reviewing' | 'error';

// Recording auto-stops (same as pressing Done) after this long, so a tap
// that's never followed up on doesn't leave the mic listening forever —
// press-and-hold used to make the "when does this stop" question moot by
// tying it to physical contact, which is exactly what felt wrong about it
// (you had to keep your finger down the whole time, which isn't how a tap
// button is supposed to work). A fixed cap replaces that without bringing
// the hold-to-talk behavior back.
const RECORDING_TIMEOUT_MS = 30000;

export function HuddleButton() {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reviewItems, setReviewItems] = useState<ReviewableAction[]>([]);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;
  // Guards against the 30s auto-timeout and a manual Done tap both firing
  // stopAndAnalyze at nearly the same moment — both would otherwise read the
  // same stale `phase` (React state updates aren't synchronous) and race
  // past the `phase !== 'recording'` check together.
  const stoppingRef = useRef(false);

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

  // Auto-stop (same as the user tapping Done) if nobody presses Cancel or
  // Done within RECORDING_TIMEOUT_MS.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setTimeout(() => {
      stopAndAnalyze();
    }, RECORDING_TIMEOUT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      stoppingRef.current = false;
      setPhase('recording');
    } catch (err: any) {
      notify('Could not start recording', String(err?.message ?? err));
    }
  };

  const stopAndAnalyze = async () => {
    if (phase !== 'recording' || stoppingRef.current) return;
    stoppingRef.current = true;
    setPhase('analyzing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was captured — tap Talk and try again.');
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
    if (phase !== 'recording') return;
    stoppingRef.current = true;
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
          pill is just a normal flex child here. A single tap starts
          recording — Cancel/Done on the overlay below are what stop it, not
          releasing the button (see RECORDING_TIMEOUT_MS note up top for why
          press-and-hold was replaced). */}
      <Pressable
        onPress={startRecording}
        disabled={phase !== 'idle'}
        style={[styles.fab, { backgroundColor: recording ? theme.colors.danger : theme.colors.ink }]}
      >
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          {analyzing ? <ActivityIndicator color={theme.colors.panel} size="small" /> : <Text style={styles.fabIcon}>🎙️</Text>}
        </Animated.View>
        <Text style={[styles.fabLabel, { color: theme.colors.panel }]}>
          {recording ? 'Listening…' : analyzing ? 'Thinking…' : 'Talk'}
        </Text>
      </Pressable>

      {/* A big, unmissable overlay while recording/analyzing — the pill's own
          label changing is too easy to miss (small text, top corner), which
          matters a lot for kids and on smaller screens. A plain absolutely-
          positioned View doesn't work here: React Native resolves
          `position: 'absolute'` against the nearest parent View regardless
          of its own positioning, and this component's parent is the small
          top-right controls row, not the full screen — so it rendered
          tiny and off to the side. Modal sidesteps that entirely (it always
          portals above everything, full-screen, same as the reviewing/error
          dialogs below). */}
      <Modal visible={recording || analyzing} transparent animationType="fade">
        <View style={styles.talkOverlay}>
          <Animated.View
            style={[
              styles.talkOverlayCircle,
              { backgroundColor: recording ? theme.colors.danger : theme.colors.ink, transform: [{ scale: pulse }] },
            ]}
          >
            {analyzing ? <ActivityIndicator color="#fff" size="large" /> : <Text style={styles.talkOverlayIcon}>🎙️</Text>}
          </Animated.View>
          <Text style={[styles.talkOverlayTitle, { fontFamily: theme.fonts.head }]}>
            {recording ? 'Listening…' : 'Thinking…'}
          </Text>
          <Text style={[styles.talkOverlaySubtitle, { fontFamily: theme.fonts.bodySemiBold }]}>
            {recording ? 'Say what you need, then tap Done' : 'Figuring out what to do with that…'}
          </Text>
          {recording && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={cancelRecording} style={[styles.talkOverlayBtn, styles.talkOverlayCancelBtn]}>
                <Text style={[styles.talkOverlayCancelText, { fontFamily: theme.fonts.headSemiBold }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={stopAndAnalyze}
                style={[styles.talkOverlayBtn, styles.talkOverlayDoneBtn, { backgroundColor: theme.colors.panel }]}
              >
                <Text style={[styles.talkOverlayDoneText, { fontFamily: theme.fonts.headSemiBold, color: theme.colors.ink }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

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
  talkOverlay: {
    flex: 1,
    backgroundColor: '#000000A0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  talkOverlayCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  talkOverlayIcon: { fontSize: 52 },
  talkOverlayTitle: { fontSize: 30, color: '#fff', marginBottom: 8 },
  talkOverlaySubtitle: { fontSize: 15, color: '#ffffffd0', textAlign: 'center', marginBottom: 24 },
  talkOverlayBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  talkOverlayCancelBtn: { borderWidth: 1.5, borderColor: '#ffffff60' },
  talkOverlayCancelText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Done is the primary action here (what you tap when you're actually
  // finished talking) — solid/light so it reads as the default choice next
  // to Cancel's plain outline.
  talkOverlayDoneBtn: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  talkOverlayDoneText: { fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 460, maxWidth: '92%', borderRadius: 24, padding: 22 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 8 },
  reviewBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});
