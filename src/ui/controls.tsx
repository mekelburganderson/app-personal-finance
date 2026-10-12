import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { T } from './Text';
import { colors, radius } from './theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 18, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'income';

const buttonTone: Record<ButtonVariant, { bg: string; fg: string; border: string; hover: string }> = {
  primary: { bg: colors.ink, fg: '#FFFFFF', border: colors.ink, hover: '#2A2D31' },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.lineStrong, hover: colors.surfaceAlt },
  ghost: { bg: 'transparent', fg: colors.ink2, border: 'transparent', hover: colors.sunken },
  danger: { bg: colors.expense, fg: '#FFFFFF', border: colors.expense, hover: '#9C3622' },
  income: { bg: colors.income, fg: '#FFFFFF', border: colors.income, hover: '#185A41' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  loading,
  disabled,
  full,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = buttonTone[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: hovered || pressed ? tone.hover : tone.bg, borderColor: tone.border },
        full && { alignSelf: 'stretch' },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} color={tone.fg} />}
          <T variant={size === 'sm' ? 'small' : 'body'} weight="medium" color={tone.fg}>
            {label}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.ink2,
  size = 36,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { width: size, height: size, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
        (hovered || pressed) && { backgroundColor: colors.sunken },
      ]}
    >
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: string;
}) {
  const activeColor = tone ?? colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.chip,
        selected
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : hovered && { backgroundColor: colors.surfaceAlt, borderColor: colors.ink3 },
      ]}
    >
      {icon && <Icon name={icon} size={14} color={selected ? '#fff' : colors.ink2} />}
      <T variant="small" weight="medium" color={selected ? '#fff' : colors.ink2}>
        {label}
      </T>
    </Pressable>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  tones,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  tones?: Partial<Record<V, string>>;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <T variant="small" weight={active ? 'semibold' : 'medium'} color={active ? tones?.[o.value] ?? colors.ink : colors.ink3}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <View style={[styles.track, value && { backgroundColor: colors.ink }]}>
        <View style={[styles.thumb, value && { transform: [{ translateX: 16 }] }]} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="body" weight="medium">{label}</T>
        {hint ? <T variant="caption" color={colors.ink3}>{hint}</T> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  buttonSm: { height: 34, paddingHorizontal: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.sunken,
    borderRadius: radius.sm,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  track: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lineStrong,
    padding: 2,
  },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
});

