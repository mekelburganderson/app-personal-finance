import { StyleSheet, View } from 'react-native';

import { fmtMoney } from '@/domain/money';
import type { CreditCard } from '@/domain/types';
import { T } from '@/ui/Text';
import { radius } from '@/ui/theme';

/** Representação do cartão físico: cor do emissor, final e uso de limite. */
export function CardVisual({ card, used }: { card: CreditCard; used: number }) {
  const pct = card.limit ? Math.min(1, used / card.limit) : 0;
  return (
    <View style={[styles.card, { backgroundColor: card.color }, card.archived && { opacity: 0.5 }]}>
      <View style={styles.top}>
        <T weight="semibold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>{card.name}</T>
        <View style={styles.chip} />
      </View>
      <T variant="small" color="rgba(255,255,255,0.75)" tabular style={{ letterSpacing: 2 }}>
        •••• •••• •••• {card.lastDigits || '0000'}
      </T>
      <View style={{ gap: 6 }}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="caption" color="rgba(255,255,255,0.75)" tabular>Usado {fmtMoney(used)}</T>
          <T variant="caption" color="rgba(255,255,255,0.75)" tabular>Limite {fmtMoney(card.limit)}</T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18, gap: 18, minHeight: 170, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { width: 32, height: 24, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
});
