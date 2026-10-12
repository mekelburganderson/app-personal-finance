import { Redirect, Slot, router, usePathname } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorProvider, useEditor } from '@/features/Editor';
import { useAuth } from '@/state/auth';
import { useData } from '@/state/data';
import { Button, Icon, type IconName } from '@/ui/controls';
import { Logo } from '@/ui/Logo';
import { Sheet } from '@/ui/overlay';
import { T } from '@/ui/Text';
import { colors, radius, useLayout } from '@/ui/theme';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Visão geral', icon: 'home' },
  { href: '/lancamentos', label: 'Lançamentos', icon: 'list' },
  { href: '/cartoes', label: 'Cartões', icon: 'credit-card' },
  { href: '/contas', label: 'Contas', icon: 'briefcase' },
  { href: '/categorias', label: 'Categorias', icon: 'tag' },
  { href: '/relatorios', label: 'Relatórios', icon: 'bar-chart-2' },
];

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export default function AppLayout() {
  const { user, ready } = useAuth();
  const { loading } = useData();
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <EditorProvider>
      <Shell>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (
          <Slot />
        )}
      </Shell>
    </EditorProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { isWide } = useLayout();
  return isWide ? (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <Sidebar />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  ) : (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
      <BottomBar />
    </View>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const editor = useEditor();
  return (
    <View style={styles.sidebar}>
      <View style={{ paddingHorizontal: 8 }}>
        <Logo light color={colors.sidebarInk} />
      </View>
      <Pressable
        onPress={() => editor.create()}
        style={({ hovered }: { hovered?: boolean }) => [styles.newBtn, hovered && { backgroundColor: '#FFFFFF' }]}
        accessibilityRole="button"
      >
        <Icon name="plus" size={17} color={colors.ink} />
        <T weight="semibold">Novo lançamento</T>
      </Pressable>
      <View style={{ gap: 2 }}>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.navigate(item.href as never)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.navItem,
                active ? styles.navActive : hovered && { backgroundColor: 'rgba(255,255,255,0.05)' },
              ]}
            >
              <Icon name={item.icon} size={17} color={active ? colors.sidebarInk : colors.sidebarMuted} />
              <T weight={active ? 'medium' : 'regular'} color={active ? colors.sidebarInk : colors.sidebarMuted}>
                {item.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.userBox}>
        <View style={styles.avatar}>
          <T variant="small" weight="semibold" color={colors.ink}>
            {initials(user?.name)}
          </T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="small" weight="medium" color={colors.sidebarInk} numberOfLines={1}>{user?.name}</T>
          <T variant="caption" color={colors.sidebarMuted} numberOfLines={1}>{user?.email}</T>
        </View>
        <Pressable onPress={signOut} accessibilityLabel="Sair" hitSlop={8} style={{ padding: 6 }}>
          <Icon name="log-out" size={16} color={colors.sidebarMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function BottomBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const editor = useEditor();
  const { user, signOut } = useAuth();
  const [more, setMore] = useState(false);
  const primary = NAV.slice(0, 3);
  const extra = NAV.slice(3);

  const tab = (item: (typeof NAV)[number]) => {
    const active = isActive(pathname, item.href);
    return (
      <Pressable key={item.href} onPress={() => router.navigate(item.href as never)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
        <Icon name={item.icon} size={20} color={active ? colors.ink : colors.ink3} />
        <T variant="caption" weight={active ? 'semibold' : 'regular'} color={active ? colors.ink : colors.ink3}>
          {item.label === 'Visão geral' ? 'Início' : item.label}
        </T>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tab(primary[0])}
      {tab(primary[1])}
      <Pressable onPress={() => editor.create()} style={styles.fab} accessibilityRole="button" accessibilityLabel="Novo lançamento">
        <Icon name="plus" size={24} color="#fff" />
      </Pressable>
      {tab(primary[2])}
      <Pressable onPress={() => setMore(true)} style={styles.tab} accessibilityRole="tab">
        <Icon name="menu" size={20} color={extra.some((i) => isActive(pathname, i.href)) ? colors.ink : colors.ink3} />
        <T variant="caption" color={colors.ink3}>Mais</T>
      </Pressable>
      <Sheet visible={more} onClose={() => setMore(false)} title={user?.name ?? 'Mais'} subtitle={user?.email}>
        {extra.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => {
              setMore(false);
              router.navigate(item.href as never);
            }}
            style={styles.moreItem}
          >
            <Icon name={item.icon} size={18} color={colors.ink2} />
            <T weight="medium" style={{ flex: 1 }}>{item.label}</T>
            <Icon name="chevron-right" size={16} color={colors.ink3} />
          </Pressable>
        ))}
        <Button label="Sair" variant="secondary" icon="log-out" onPress={signOut} />
      </Sheet>
    </View>
  );
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    backgroundColor: colors.sidebar,
    paddingHorizontal: 14,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 22,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.sidebarInk,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  navActive: { backgroundColor: 'rgba(255,255,255,0.09)' },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sidebarInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    marginTop: -22,
    borderWidth: 4,
    borderColor: colors.bg,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
