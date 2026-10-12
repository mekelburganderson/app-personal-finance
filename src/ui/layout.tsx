import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './controls';
import { T } from './Text';
import { colors, radius, useLayout } from './theme';

export function Screen({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const { isWide, isMedium } = useLayout();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: isWide ? 48 : 120 }}>
      <View style={[styles.inner, { paddingHorizontal: isMedium ? 32 : 16, paddingTop: isWide ? 32 : 16 }]}>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <T variant={isMedium ? 'h1' : 'h2'}>{title}</T>
            {subtitle ? <T variant="small" color={colors.ink3} style={{ marginTop: 2 }}>{subtitle}</T> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function Panel({
  children,
  title,
  action,
  style,
  padded = true,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[styles.panel, !padded && { padding: 0, gap: 0, overflow: 'hidden' }, style]}>
      {title ? (
        <View style={[styles.panelHead, !padded && { paddingHorizontal: 18, paddingTop: 16 }]}>
          <T variant="title" weight="semibold">{title}</T>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export type BadgeTone = 'neutral' | 'income' | 'expense' | 'warn' | 'info' | 'dark';

const badgeTones: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.sunken, fg: colors.ink2 },
  income: { bg: colors.incomeSoft, fg: colors.income },
  expense: { bg: colors.expenseSoft, fg: colors.expense },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  info: { bg: colors.infoSoft, fg: colors.info },
  dark: { bg: colors.ink, fg: '#fff' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <T variant="caption" weight="medium" color={t.fg}>{label}</T>
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={20} color={colors.ink2} />
      </View>
      <T variant="title" weight="semibold" align="center">{title}</T>
      {message ? <T variant="small" color={colors.ink3} align="center" style={{ maxWidth: 360 }}>{message}</T> : null}
      {action}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

/** Barra de progresso fina (uso de limite, participação de categoria). */
export function Meter({ value, color = colors.ink, track = colors.sunken, height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { width: '100%', maxWidth: 1200, alignSelf: 'center', gap: 20 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', flexShrink: 1, maxWidth: '100%' },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 14,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
