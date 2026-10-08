// A real live-camera capture UI for web. expo-image-picker's
// launchCameraAsync() falls back to a plain file-upload dialog on desktop
// browsers — the `capture` attribute on <input type="file"> is only honored
// by mobile browsers — so Snap would otherwise silently become "upload a
// picture" instead of "take a picture" when run in a desktop browser. This
// opens the device camera directly via getUserMedia and lets you snap a
// frame from the live preview, giving the same "point and shoot" experience
// expo-image-picker's native camera gives on iOS/Android.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  visible: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
};

export function WebCameraModal({ visible, onCapture, onClose }: Props) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err: any) => setError(err?.message || 'Could not access the camera.'));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [visible]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.85,
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.panel }]}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.colors.ink, marginBottom: 12 }}>
            Point the camera at the flyer
          </Text>
          {error ? (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.danger, marginBottom: 4 }}>
              {error}
            </Text>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: theme.colors.fieldBg }]}>
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.inkSoft }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={capture}
              disabled={!!error}
              style={[styles.btn, { backgroundColor: theme.colors.ink, opacity: error ? 0.4 : 1 }]}
            >
              <Text style={{ fontFamily: theme.fonts.headSemiBold, color: theme.colors.panel }}>Take Photo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const videoStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 360,
  borderRadius: 14,
  backgroundColor: '#000',
  objectFit: 'cover',
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center' },
  card: { width: 480, maxWidth: '92%', borderRadius: 24, padding: 22 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
});
