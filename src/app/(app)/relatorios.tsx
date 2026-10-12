import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FREQUENCY_LABEL, addMonthsRef, fmtDate, fmtRef, monthRef, today } from '@/domain/dates';
import { monthlyEvolution, totalsByCategory } from '@/domain/finance';
import { fmtMoney } from '@/domain/money';
import type { EntryKind, Transaction } from '@/domain/types';
import { PeriodPicker, usePeriod } from '@/features/PeriodPicker';
import { useData } from '@/state/data';
import { PairedBars, RankBars } from '@/ui/charts';
import { Segmented } from '@/ui/controls';
import { EmptyState, Panel, Screen } from '@/ui/layout';
import { Money, T } from '@/ui/Text';
import { colors, useLayout } from '@/ui/theme';

type Tab = 'categorias' | 'evolucao' | 'cartoes' | 'fixas';

export default function Relatorios() {
  const [tab, setTab] = useState<Tab>('categorias');
  const { isMedium } = useLayout();
  return (
    <Screen title="Relatórios" subtitle="Para onde vai e de onde vem o dinheiro">
      <View style={{ maxWidth: isMedium ? 620 : undefined }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'categorias', label: 'Categorias' },
            { value: 'evolucao', label: 'Evolução' },
            { value: 'cartoes', label: 'Cartões' },
            { value: 'fixas', label: isMedium ? 'Fixas e parcelas' : 'Fixas' },
          ]}
        />
      </View>
      {tab === 'categorias' ? <ByCategory /> : null}
      {tab === 'evolucao' ? <Evolution /> : null}
      {tab === 'cartoes' ? <Cards /> : null}
      {tab === 'fixas' ? <Commitments /> : null}
    </Screen>
  );
}

function ByCategory() {
  const data = useData();
  const [period, setPeriod] = usePeriod('mes');
  const [kind, setKind] = useState<EntryKind>('despesa');
  const rows = useMemo(() => totalsByCategory(data.transactions, kind, period.period), [data.transactions, kind, period.period]);
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <View style={styles.filters}>
        <PeriodPicker value={period} onChange={setPeriod} presets={['mes', '30', '90']} />
        <View style={{ width: 220 }}>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'despesa', label: 'Despesas' }, { value: 'receita', label: 'Receitas' }]} />
        </View>
      </View>
      <Panel title={`${kind === 'despesa' ? 'Despesas' : 'Receitas'} por categoria`} action={<Money weight="semibold" value={total} />}>
        {rows.length ? (
          <RankBars
            color={kind === 'despesa' ? colors.chartExpense : colors.chartIncome}
            total={total}
            rows={rows.map((r) => {
              const cat = data.categoryById.get(r.categoryId);
              const subs = r.subs
                .filter(([id]) => id !== '__none__')
                .map(([id, v]) => `${data.categoryById.get(id)?.name ?? '—'} ${fmtMoney(v)}`)
                .join(' · ');
              return { key: r.categoryId, label: cat?.name ?? 'Sem categoria', value: r.total, swatch: cat?.color, detail: subs || undefined };
            })}
          />
        ) : (
          <EmptyState icon="pie-chart" title="Nada no período" />
        )}
        <T variant="caption" color={colors.ink3}>Considera a data de lançamento (competência), incluindo compras no cartão e itens em aberto.</T>
      </Panel>
    </>
  );
}

function Evolution() {
  const data = useData();
  const [months, setMonths] = useState<'6' | '12'>('6');
  const ref = monthRef(today());
  const rows = useMemo(() => monthlyEvolution(data.transactions, addMonthsRef(ref, 2), Number(months)), [data.transactions, ref, months]);

  return (
    <>
      <View style={{ width: 240 }}>
        <Segmented value={months} onChange={setMonths} options={[{ value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} />
      </View>
      <Panel title="Receitas e despesas por mês" action={<T variant="caption" color={colors.ink3}>Por vencimento · inclui 2 meses à frente</T>}>
        <PairedBars
          height={220}
          aLabel="Receitas"
          bLabel="Despesas"
          data={rows.map((r) => ({ key: r.ref, label: fmtRef(r.ref), title: fmtRef(r.ref), a: r.receitas, b: r.despesas }))}
        />
      </Panel>
      <Panel padded={false}>
        <TableRow head cells={['Mês', 'Receitas', 'Despesas', 'Resultado']} />
        {rows.map((r) => (
          <TableRow
            key={r.ref}
            highlight={r.ref === ref}
            cells={[
              fmtRef(r.ref) + (r.ref > ref ? ' (previsto)' : ''),
              <Money key="a" variant="small" value={r.receitas} />,
              <Money key="b" variant="small" value={r.despesas} />,
              <Money key="c" variant="small" weight="semibold" value={r.resultado} tone="auto" signed />,
            ]}
          />
        ))}
      </Panel>
    </>
  );
}

function Cards() {
  const data = useData();
  const ref = monthRef(today());
  const refs = Array.from({ length: 6 }, (_, i) => addMonthsRef(ref, i - 3));
  const cards = data.cards.filter((c) => !c.archived);
  if (!cards.length) return <Panel><EmptyState icon="credit-card" title="Nenhum cartão cadastrado" /></Panel>;

  return (
    <Panel padded={false} title="Faturas por mês de vencimento">
      <View style={{ height: 12 }} />
      <TableRow head cells={['Cartão', ...refs.map(fmtRef)]} />
      {cards.map((card) => {
        const invoices = data.invoicesByCard.get(card.id) ?? [];
        return (
          <TableRow
            key={card.id}
            cells={[
              card.name,
              ...refs.map((r) => {
                const inv = invoices.find((i) => i.ref === r);
                return (
                  <View key={r} style={{ alignItems: 'flex-end' }}>
                    <Money variant="small" value={inv?.total ?? 0} color={inv ? colors.ink : colors.ink3} />
                    {inv && inv.status === 'paga' ? <T variant="caption" color={colors.income}>paga</T> : null}
                  </View>
                );
              }),
            ]}
          />
        );
      })}
      <TableRow
        head
        cells={[
          'Total',
          ...refs.map((r) => (
            <Money key={r} variant="small" weight="semibold" value={cards.reduce((s, c) => s + ((data.invoicesByCard.get(c.id) ?? []).find((i) => i.ref === r)?.total ?? 0), 0)} />
          )),
        ]}
      />
    </Panel>
  );
}

function Commitments() {
  const data = useData();
  const T0 = today();

  const series = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of data.transactions) {
      if (!t.seriesId || t.kind !== 'despesa') continue;
      map.set(t.seriesId, [...(map.get(t.seriesId) ?? []), t]);
    }
    return [...map.values()]
      .map((list) => {
        list.sort((a, b) => a.seriesIndex - b.seriesIndex);
        const pending = list.filter((t) => (t.cardId ? t.dueDate >= T0 : t.status === 'aberto'));
        return { first: list[0], next: pending[0], remaining: pending.length, remainingAmount: pending.reduce((s, t) => s + t.amount, 0) };
      })
      .filter((s) => s.remaining > 0)
      .sort((a, b) => (a.next?.dueDate ?? '').localeCompare(b.next?.dueDate ?? ''));
  }, [data.transactions, T0]);

  const fixed = series.filter((s) => s.first.seriesType === 'recorrente');
  const installments = series.filter((s) => s.first.seriesType === 'parcelado');
  const monthlyFixed = fixed.filter((s) => s.first.frequency === 'mensal').reduce((sum, s) => sum + s.next!.amount, 0);

  return (
    <>
      <Panel title="Despesas fixas (recorrentes)" action={<T variant="small" color={colors.ink3}>Mensais: <Money variant="small" weight="semibold" value={monthlyFixed} /></T>}>
        <View style={{ marginHorizontal: -18, marginBottom: -18 }}>
          <TableRow head cells={['Descrição', 'Frequência', 'Próximo venc.', 'Valor']} />
          {fixed.length ? fixed.map((s) => (
            <TableRow key={s.first.seriesId} cells={[s.first.description, s.first.frequency ? FREQUENCY_LABEL[s.first.frequency] : '—', fmtDate(s.next?.dueDate), <Money key="v" variant="small" value={s.next?.amount ?? 0} />]} />
          )) : <T variant="small" color={colors.ink3} style={{ padding: 18 }}>Nenhuma despesa recorrente.</T>}
        </View>
      </Panel>
      <Panel title="Parcelamentos ativos" action={<T variant="small" color={colors.ink3}>Saldo devedor: <Money variant="small" weight="semibold" value={installments.reduce((s, i) => s + i.remainingAmount, 0)} /></T>}>
        <View style={{ marginHorizontal: -18, marginBottom: -18 }}>
          <TableRow head cells={['Descrição', 'Parcelas restantes', 'Próximo venc.', 'Restante']} />
          {installments.length ? installments.map((s) => (
            <TableRow
              key={s.first.seriesId}
              cells={[
                s.first.description + (s.first.cardId ? ` · ${data.cardById.get(s.first.cardId)?.name ?? ''}` : ''),
                `${s.remaining} de ${s.first.seriesTotal}`,
                fmtDate(s.next?.dueDate),
                <Money key="v" variant="small" value={s.remainingAmount} />,
              ]}
            />
          )) : <T variant="small" color={colors.ink3} style={{ padding: 18 }}>Nenhum parcelamento em andamento.</T>}
        </View>
      </Panel>
    </>
  );
}

function TableRow({ cells, head, highlight }: { cells: React.ReactNode[]; head?: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.tr, head && styles.th, highlight && { backgroundColor: colors.surfaceAlt }]}>
      {cells.map((c, i) => (
        <View key={i} style={[styles.td, i === 0 ? { flex: 2 } : { alignItems: 'flex-end' }]}>
          {typeof c === 'string' ? (
            <T variant={head ? 'caption' : 'small'} weight={head || i === 0 ? 'medium' : 'regular'} color={head ? colors.ink3 : colors.ink} numberOfLines={2} align={i === 0 ? 'left' : 'right'}>
              {c}
            </T>
          ) : (
            c
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  th: { backgroundColor: colors.surfaceAlt },
  td: { flex: 1, minWidth: 0 },
});
