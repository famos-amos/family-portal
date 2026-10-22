// Small stroke-based icon set matching the mockups (Feather-style: 24px
// viewBox, round line caps/joins). Kept as plain SVG so there's no icon-font
// dependency to configure.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

const base = (size = 20, color = '#000') => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function HomeIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M3 11l9-7 9 7" />
      <Path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

export function CalendarIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="3" y="5" width="18" height="16" rx="3" />
      <Path d="M8 3v4M16 3v4M3 10h18" />
    </Svg>
  );
}

export function ChoresIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M9 11l3 3L22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

export function MealIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M18 2v20M15 2v7a3 3 0 0 0 6 0V2M6 2v7a2 2 0 0 0 4 0V2" />
    </Svg>
  );
}

export function BoardsIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Path d="M4 10h16M10 4v16" />
    </Svg>
  );
}

export function SettingsIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function PlusIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2.5}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={3}>
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={3}>
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

export function CheckIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={3}>
      <Path d="M4 12l5 5L20 6" />
    </Svg>
  );
}

export function TrashIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2.2}>
      <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </Svg>
  );
}

export function EditIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2.2}>
      <Path d="M3 21l4-1L18.5 8.5a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0L4 16.5z" />
    </Svg>
  );
}

export function StarIcon({ size = 16, color = '#F2B33D', filled = true }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={filled ? 0 : 1.5}>
      <Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </Svg>
  );
}

export function DragHandleIcon({ size = 15, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <Circle cx="4" cy="3" r="1.6" />
      <Circle cx="12" cy="3" r="1.6" />
      <Circle cx="4" cy="8" r="1.6" />
      <Circle cx="12" cy="8" r="1.6" />
      <Circle cx="4" cy="13" r="1.6" />
      <Circle cx="12" cy="13" r="1.6" />
    </Svg>
  );
}

export function ResizeHandleIcon({ size = 13, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
      <Path d="M14 3L3 14M14 8L8 14M14 13L13 14" />
    </Svg>
  );
}

export function BookIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  );
}

export function QuestionIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M12 18h.01M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
      <Circle cx="12" cy="12" r="9" />
    </Svg>
  );
}

export function QrCodeIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="3" y="3" width="7" height="7" rx="1" />
      <Rect x="14" y="3" width="7" height="7" rx="1" />
      <Rect x="3" y="14" width="7" height="7" rx="1" />
      <Path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" />
    </Svg>
  );
}

export function MicIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Path d="M12 19v4M8 23h8" />
    </Svg>
  );
}

export function CameraIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function ImageIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Path d="M21 15l-5-5L5 21" />
    </Svg>
  );
}

export function PaletteIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M12 2a10 10 0 1 0 0 20c1.5 0 2-1 2-2s-.5-1.5-.5-2.5A2.5 2.5 0 0 1 16 15h2a4 4 0 0 0 4-4 9 9 0 0 0-10-9z" />
      <Circle cx="7.5" cy="10.5" r="1" />
      <Circle cx="11" cy="7" r="1" />
      <Circle cx="15.5" cy="8" r="1" />
      <Circle cx="17.5" cy="12" r="1" />
    </Svg>
  );
}

export function DevicesIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="2" y="4" width="14" height="16" rx="2" />
      <Rect x="17" y="9" width="5" height="11" rx="1.5" />
    </Svg>
  );
}
