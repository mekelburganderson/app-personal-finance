import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fmtCompact, fmtMoney } from '@/domain/money';
import { T } from './Text';
import { colors } from './theme';

export interface PairPoint {
  key: string;
  label: string;
  /** Rótulo longo exibido no destaque ao passar o mouse/tocar. */
  title: string;
  a: number;
  b: number;
}

function niceMax(v: number) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <T variant="caption" color={colors.ink2}>{label}</T>
    </View>
  );
}

/**
 * Barras pareadas (receitas x despesas) com um eixo só, grade discreta e
 * leitura detalhada ao passar o mouse ou tocar em uma coluna.
 */
export function PairedBars({
  data,
  aLabel,
  bLabel,
  aColor = colors.chartIncome,
  bColor = colors.chartExpense,
  height = 180,
  emptyText = 'Sem movimentação no período.',
}: {
  data: PairPoint[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  height?: number;
  emptyText?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.a, d.b])));
  const hasData = data.some((d) => d.a > 0 || d.b > 0);
  const labelEvery = Math.ceil(data.length / 8);
  const current = active != null ? data[active] : null;
  const totals = data.reduce((s, d) => ({ a: s.a + d.a, b: s.b + d.b }), { a: 0, b: 0 });

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.readout}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <LegendDot color={aColor} label={aLabel} />
          <LegendDot color={bColor} label={bLabel} />
        </View>
        <T variant="caption" color={colors.ink3} tabular numberOfLines={1}>
          {current
            ? `${current.title} · ${aLabel} ${fmtMoney(current.a)} · ${bLabel} ${fmtMoney(current.b)}`
            : `Total · ${aLabel} ${fmtMoney(totals.a)} · ${bLabel} ${fmtMoney(totals.b)}`}
        </T>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ height, justifyContent: 'space-between', alignItems: 'flex-end', width: 52 }}>
          {[max, max / 2, 0].map((v) => (
            <T key={v} variant="caption" color={colors.ink3} tabular numberOfLines={1} style={{ marginTop: v === max ? -7 : 0, marginBottom: v === 0 ? -7 : 0 }}>
              {fmtCompact(v)}
            </T>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ height }}>
            {[0, 0.5, 1].map((p) => (
              <View key={p} style={[styles.grid, { top: `${p * 100}%` }, p === 1 && { backgroundColor: colors.lineStrong }]} />
            ))}
            {!hasData ? (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <T variant="small" color={colors.ink3}>{emptyText}</T>
              </View>
            ) : null}
            <View style={styles.columns} onPointerLeave={() => setActive(null)}>
              {data.map((d, i) => {
                const dim = active != null && active !== i;
                return (
                  <Pressable
                    key={d.key}
                    onHoverIn={() => setActive(i)}
                    onPressIn={() => setActive(i)}
                    accessibilityLabel={`${d.title}: ${aLabel} ${fmtMoney(d.a)}, ${bLabel} ${fmtMoney(d.b)}`}
                    style={[styles.column, active === i && { backgroundColor: 'rgba(21,23,26,0.04)' }]}
                  >
                    <View style={styles.pair}>
                      <View style={[styles.bar, { height: `${(d.a / max) * 100}%`, backgroundColor: aColor, opacity: dim ? 0.35 : 1 }]} />
                      <View style={[styles.bar, { height: `${(d.b / max) * 100}%`, backgroundColor: bColor, opacity: dim ? 0.35 : 1 }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {data
              .filter((_, i) => i % labelEvery === 0)
              .map((d, i, arr) => (
                <View key={d.key} style={{ flex: i === arr.length - 1 ? data.length - i * labelEvery : labelEvery }}>
                  <T variant="caption" color={colors.ink3} numberOfLines={1}>{d.label}</T>
                </View>
              ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Ranking horizontal (ex.: despesas por categoria). Uma cor só: a magnitude é o comprimento. */
export function RankBars({
  rows,
  color = colors.chartExpense,
  total,
}: {
  rows: { key: string; label: string; value: number; swatch?: string; detail?: string }[];
  color?: string;
  total?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {r.swatch ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.swatch }} /> : null}
            <T variant="small" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{r.label}</T>
            <T variant="caption" color={colors.ink3} tabular>{sum ? Math.round((r.value / sum) * 100) : 0}%</T>
            <T variant="small" tabular style={{ minWidth: 92, textAlign: 'right' }}>{fmtMoney(r.value)}</T>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.grid, overflow: 'hidden' }}>
            <View style={{ width: `${(r.value / max) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
          </View>
          {r.detail ? <T variant="caption" color={colors.ink3}>{r.detail}</T> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.grid },
  columns: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', borderRadius: 4 },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%', width: '72%', maxWidth: 28, justifyContent: 'center' },
  bar: { flex: 1, maxWidth: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 0 },
});
