import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fmtDate, inRange, parseISO } from '@/domain/dates';
import type { EntryKind, Transaction } from '@/domain/types';
import { useEditor } from '@/features/Editor';
import { accountOptions, cardOptions } from '@/features/options';
import { PeriodPicker, presetPeriod, type PeriodValue } from '@/features/PeriodPicker';
import { TransactionRow } from '@/features/TransactionRow';
import { useData, useTransactionStatus } from '@/state/data';
import { Button, Chip, Segmented } from '@/ui/controls';
import { Row, Select, TextField, type SelectOption } from '@/ui/fields';
import { EmptyState, Panel, Screen } from '@/ui/layout';
import { Money, T } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

type StatusFilter = 'todos' | 'aberto' | 'vencido' | 'pago';
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default function Lancamentos() {
  const params = useLocalSearchParams<{ status?: string }>();
  const data = useData();
  const editor = useEditor();
  const statusOf = useTransactionStatus();

  const initialStatus = (['aberto', 'vencido', 'pago'].includes(params.status ?? '') ? params.status : 'todos') as StatusFilter;
  const [period, setPeriod] = useState<PeriodValue>(() =>
    initialStatus === 'vencido'
      ? { preset: '90', period: presetPeriod('90') }
      : { preset: 'mes', period: presetPeriod('mes') },
  );
  const [basis, setBasis] = useState<'dueDate' | 'launchDate'>('dueDate');
  const [kind, setKind] = useState<'todos' | EntryKind>('todos');
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [origin, setOrigin] = useState<'todos' | 'avulso' | 'cartao'>('todos');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showMore, setShowMore] = useState(false);

  const categoryFilterOptions = useMemo<SelectOption[]>(
    () =>
      data.categories
        .filter((c) => !c.parentId)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name, hint: c.kind === 'receita' ? 'Receita' : 'Despesa', color: c.color })),
    [data.categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.transactions
      .filter((t) => inRange(t[basis], period.period.from, period.period.to))
      .filter((t) => kind === 'todos' || t.kind === kind)
      .filter((t) => status === 'todos' || statusOf(t) === status || (status === 'aberto' && statusOf(t) === 'vencido'))
      .filter((t) => origin === 'todos' || (origin === 'cartao' ? !!t.cardId : !t.cardId))
      .filter((t) => !accountId || (t.accountId === accountId && !t.cardId))
      .filter((t) => !cardId || t.cardId === cardId)
      .filter((t) => !categoryId || t.categoryId === categoryId)
      .filter((t) => !q || t.description.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
      .sort((a, b) => a[basis].localeCompare(b[basis]) || a.description.localeCompare(b.description));
  }, [data.transactions, basis, period, kind, status, origin, accountId, cardId, categoryId, query, statusOf]);

  const totals = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    for (const t of filtered) {
      if (t.kind === 'receita') receitas += t.amount;
      else despesas += t.amount;
    }
    return { receitas, despesas };
  }, [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = map.get(t[basis]) ?? [];
      list.push(t);
      map.set(t[basis], list);
    }
    return [...map.entries()];
  }, [filtered, basis]);

  const activeExtra = [accountId, cardId, categoryId].filter(Boolean).length + (origin !== 'todos' ? 1 : 0);

  const clear = () => {
    setKind('todos');
    setStatus('todos');
    setOrigin('todos');
    setAccountId(null);
    setCardId(null);
    setCategoryId(null);
    setQuery('');
  };

  return (
    <Screen
      title="Lançamentos"
      subtitle="Receitas e despesas por período"
      actions={
        <>
          <Button label="Receita" variant="secondary" icon="plus" onPress={() => editor.create({ kind: 'receita' })} />
          <Button label="Despesa" icon="plus" onPress={() => editor.create({ kind: 'despesa' })} />
        </>
      }
    >
      <Panel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <PeriodPicker value={period} onChange={setPeriod} presets={['mes', '30', '90', 'prox30']} />
          <View style={{ width: 260 }}>
            <Segmented
              value={basis}
              onChange={setBasis}
              options={[
                { value: 'dueDate', label: 'Por vencimento' },
                { value: 'launchDate', label: 'Por lançamento' },
              ]}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(['todos', 'receita', 'despesa'] as const).map((k) => (
            <Chip key={k} label={k === 'todos' ? 'Tudo' : k === 'receita' ? 'Receitas' : 'Despesas'} selected={kind === k} onPress={() => setKind(k)} />
          ))}
          <View style={styles.sep} />
          {(['todos', 'aberto', 'vencido', 'pago'] as const).map((s) => (
            <Chip
              key={s}
              label={s === 'todos' ? 'Qualquer status' : s === 'aberto' ? 'Em aberto' : s === 'vencido' ? 'Vencidos' : 'Pagos/recebidos'}
              selected={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
          <View style={styles.sep} />
          <Chip icon="sliders" label={activeExtra ? `Filtros (${activeExtra})` : 'Mais filtros'} selected={showMore} onPress={() => setShowMore((v) => !v)} />
        </View>
        {showMore ? (
          <Row>
            <Select
              label="Origem"
              value={origin}
              options={[
                { value: 'todos', label: 'Todas' },
                { value: 'avulso', label: 'Fora do cartão' },
                { value: 'cartao', label: 'Cartão de crédito' },
              ]}
              onChange={(v) => setOrigin((v as typeof origin) ?? 'todos')}
            />
            <Select label="Conta" value={accountId} options={accountOptions(data.accounts, accountId)} onChange={setAccountId} placeholder="Todas" allowClear />
            <Select label="Cartão" value={cardId} options={cardOptions(data.cards, cardId)} onChange={setCardId} placeholder="Todos" allowClear />
            <Select label="Categoria" value={categoryId} options={categoryFilterOptions} onChange={setCategoryId} placeholder="Todas" allowClear />
          </Row>
        ) : null}
        <TextField placeholder="Buscar por descrição ou observação" value={query} onChangeText={setQuery} />
      </Panel>

      <View style={styles.summary}>
        <Summary label="Receitas" value={totals.receitas} tone="income" />
        <Summary label="Despesas" value={-totals.despesas} />
        <Summary label="Saldo" value={totals.receitas - totals.despesas} tone="auto" />
        <View style={styles.summaryItem}>
          <T variant="label" color={colors.ink3}>Itens</T>
          <T variant="h2" tabular>{filtered.length}</T>
        </View>
      </View>

      <Panel padded={false}>
        {groups.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Nenhum lançamento encontrado"
            message="Ajuste o período ou os filtros, ou crie um novo lançamento."
            action={activeExtra || kind !== 'todos' || status !== 'todos' || query ? <Button label="Limpar filtros" variant="secondary" onPress={clear} /> : undefined}
          />
        ) : (
          groups.map(([date, list]) => {
            const dayTotal = list.reduce((s, t) => s + (t.kind === 'receita' ? t.amount : -t.amount), 0);
            return (
              <View key={date}>
                <View style={styles.dayHead}>
                  <T variant="caption" weight="semibold" color={colors.ink2}>
                    {fmtDate(date)} · {WEEKDAYS[parseISO(date).getDay()]}
                  </T>
                  <Money variant="caption" value={dayTotal} color={colors.ink3} signed />
                </View>
                {list.map((t) => <TransactionRow key={t.id} t={t} dateField={basis} />)}
              </View>
            );
          })
        )}
      </Panel>
    </Screen>
  );
}

function Summary({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'income' | 'auto' }) {
  return (
    <View style={styles.summaryItem}>
      <T variant="label" color={colors.ink3}>{label}</T>
      <Money variant="h2" value={value} tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  sep: { width: 1, height: 20, backgroundColor: colors.line, marginHorizontal: 4 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  summaryItem: { flexGrow: 1, flexBasis: 140, padding: 16, gap: 4 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
