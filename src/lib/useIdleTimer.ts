// Tracks "has anyone touched/clicked/typed in the last N minutes" so
// App.tsx knows when to show the ambient screensaver. `reset()` is the one
// thing callers need to wire up to real activity:
//   - Web: this hook listens to window-level mouse/touch/key/wheel events
//     itself — nothing else to wire up.
//   - Native: App.tsx calls `reset()` from a root View's onTouchStart, since
//     there's no `window` to attach a global listener to. Touching the
//     screensaver itself counts too — it's rendered as a child of that same
//     root View, so the touch bubbles up and dismisses it automatically.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export function useIdleTimer(idleMs: number, enabled: boolean): { idle: boolean; reset: () => void } {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (enabled && idleMs > 0) {
      timerRef.current = setTimeout(() => setIdle(true), idleMs);
    }
  }, [enabled, idleMs]);

  // Re-arm whenever `enabled`/`idleMs` change (e.g. turning the feature on,
  // or changing the idle delay in Settings).
  useEffect(() => {
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onActivity = () => reset();
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener('mousemove', onActivity, opts);
    window.addEventListener('mousedown', onActivity, opts);
    window.addEventListener('keydown', onActivity, opts);
    window.addEventListener('touchstart', onActivity, opts);
    window.addEventListener('wheel', onActivity, opts);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('wheel', onActivity);
    };
  }, [reset]);

  return { idle, reset };
}
