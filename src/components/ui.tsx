// Small shared UI primitives styled to the Warm & Playful theme.
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { contrastText } from '../lib/contrastColor';

export function Card({
  children,
  style,
  backgroundColor,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: backgroundColor ?? theme.colors.panel,
          borderRadius: theme.radii.xl,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.cardTitle, { fontFamily: theme.fonts.head, color: theme.colors.ink }]}>{children}</Text>
  );
}

export function Chip({
  label,
  color,
  active = true,
}: {
  label: string;
  color?: string;
  active?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: color ?? (theme.isDark ? '#FFFFFF16' : '#00000008'),
          opacity: active ? 1 : 0.5,
        },
      ]}
    >
      <Text style={[styles.chipText, { fontFamily: theme.fonts.headSemiBold, color: theme.colors.ink }]}>
        {label}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  color,
  icon: Icon,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  /** An icon component (e.g. PlusIcon), not a pre-colored element — this
   * button owns the icon's color so it can keep it readable against
   * whichever background color it ends up with (see contrastText). */
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const theme = useTheme();
  const bg = color ?? theme.colors.ink;
  const fg = contrastText(bg);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryBtn, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
    >
      {Icon && <Icon size={15} color={fg} />}
      <Text style={[styles.primaryBtnText, { fontFamily: theme.fonts.headSemiBold, color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.isDark ? '#FFFFFF14' : '#00000010' }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segmentBtn,
              active && { backgroundColor: theme.colors.panel, shadowOpacity: 0.15 },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { fontFamily: theme.fonts.headSemiBold, color: active ? theme.colors.ink : theme.colors.inkSoft },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Switch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[
        styles.switchTrack,
        { backgroundColor: value ? theme.colors.success : theme.isDark ? '#FFFFFF20' : '#00000020' },
      ]}
    >
      <View style={[styles.switchKnob, value && { left: 19 }]} />
    </Pressable>
  );
}

export function Checkbox({ checked, onPress, color }: { checked: boolean; onPress: () => void; color?: string }) {
  const theme = useTheme();
  const c = color ?? theme.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.checkbox,
        { borderColor: checked ? c : theme.colors.border, backgroundColor: checked ? c : 'transparent' },
      ]}
    >
      {checked && (
        <View style={styles.checkMark}>
          <Text style={{ color: contrastText(c), fontSize: 11, fontWeight: '700' }}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: 15, marginBottom: 10 },
  chip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 10.5 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnText: { fontSize: 14 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  segmentText: { fontSize: 13 },
  switchTrack: { width: 40, height: 23, borderRadius: 999, padding: 2, justifyContent: 'center' },
  switchKnob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#fff',
    position: 'absolute',
    left: 2,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { alignItems: 'center', justifyContent: 'center' },
});
