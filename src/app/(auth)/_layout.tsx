import { Redirect, Slot } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/state/auth';
import { Logo } from '@/ui/Logo';
import { T } from '@/ui/Text';
import { colors, useLayout } from '@/ui/theme';

const POINTS = [
  ['Cartões e faturas', 'Compras caem na fatura certa pela data de fechamento.'],
  ['Parcelas e recorrências', 'Defina vencimento de cada parcela ou repita contas fixas.'],
  ['O que vem pela frente', 'A pagar e a receber nos próximos 7 dias, sem surpresa.'],
];

export default function AuthLayout() {
  const { user, ready } = useAuth();
  const { isWide } = useLayout();
  if (!ready) return null;
  if (user) return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      {isWide ? (
        <View style={styles.aside}>
          <Logo light color={colors.sidebarInk} />
          <View style={{ gap: 28 }}>
            <T variant="display" color={colors.sidebarInk} style={{ maxWidth: 420 }}>
              Seu dinheiro, lançado com calma e conferido de verdade.
            </T>
            <View style={{ gap: 18 }}>
              {POINTS.map(([title, text], i) => (
                <View key={title} style={{ flexDirection: 'row', gap: 14 }}>
                  <T variant="small" color={colors.sidebarMuted} tabular style={{ width: 20 }}>
                    0{i + 1}
                  </T>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="medium" color={colors.sidebarInk}>{title}</T>
                    <T variant="small" color={colors.sidebarMuted}>{text}</T>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <T variant="caption" color={colors.sidebarMuted}>Protótipo · dados salvos apenas neste navegador</T>
        </View>
      ) : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {!isWide ? <Logo /> : null}
          <Slot />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  aside: {
    width: '44%',
    maxWidth: 620,
    backgroundColor: colors.sidebar,
    padding: 48,
    justifyContent: 'space-between',
  },
  main: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 28 },
});
