import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Splits a container into `count` equal columns using an integer pixel width
 * measured from the container itself, instead of a `${100 / count}%` style on
 * each child.
 *
 * On web, sub-pixel percentage widths lay out fine. In a real React Native
 * runtime (Expo Go, native builds) Yoga rounds every child to the physical
 * pixel grid, so `count` cells at `100 / count %` can total a hair over 100%
 * and the last cell in the row (e.g. Saturday, or Sunday) wraps onto its own
 * line. Flooring `width / count` guarantees the whole row fits.
 *
 * Returns `[colWidth, onLayout]`. `colWidth` is `undefined` until the first
 * layout pass — callers should fall back to the percentage width until then.
 */
export function useColumnWidth(count: number): [number | undefined, (e: LayoutChangeEvent) => void] {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth((prev) => (prev !== null && Math.abs(prev - w) < 0.5 ? prev : w));
  }, []);

  const colWidth = containerWidth != null ? Math.floor(containerWidth / count) : undefined;
  return [colWidth, onLayout];
}
