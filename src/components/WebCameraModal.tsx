// Native (iOS/Android) builds use expo-image-picker's real camera instead
// (see SnapButton.tsx) — this file only exists so the import resolves on
// native. The actual getUserMedia-based implementation is
// WebCameraModal.web.tsx, which Metro picks automatically on web.
export function WebCameraModal(_props: {
  visible: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
}) {
  return null;
}
