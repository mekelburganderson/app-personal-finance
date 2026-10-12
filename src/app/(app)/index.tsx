import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { diffDays, fmtDate, fmtShort, today } from '@/domain/dates';
import { accountBalance, computeDashboard, totalsByCategory, type UpcomingItem } from '@/domain/finance';
import { INVOICE_STATUS_LABEL } from '@/domain/labels';
import { fmtMoney } from '@/domain/money';
import { useEditor } from '@/features/Editor';
import { PeriodPicker, usePeriod } from '@/features/PeriodPicker';
import { useAuth } from '@/state/auth';
import { useData } from '@/state/data';
import { PairedBars, RankBars } from '@/ui/charts';
import { Button, Icon, type IconName } from '@/ui/controls';
import { Badge, EmptyState, Meter, Panel, Screen } from '@/ui/layout';
import { Money, T } from '@/ui/Text';
import { colors, radius, useLayout } from '@/ui/theme';

export default function Dashboard() {
  const { user } = useAuth();
  const data = useData();
  const editor = useEditor();
  const { isWide, isMedium } = useLayout();
  const [period, setPeriod] = usePeriod('30');
  const T0 = today();

  const d = useMemo(
    () =>
      computeDashboard({
        accounts: data.accounts,
        cards: data.cards,
        transactions: data.transactions,
        payments: data.invoicePayments,
        period: period.period,
        refDate: T0,
      }),
    [data.accounts, data.cards, data.transactions, data.invoicePayments, period.period, T0],
  );

  const byCategory = useMemo(
    () => totalsByCategory(data.transactions, 'despesa', period.period).slice(0, 6),
    [data.transactions, period.period],
  );

  const chartData = d.series.map((p, i) => ({
    key: p.date,
    label: fmtShort(p.date),
    title: d.series.length > 31 || (i > 0 && diffDays(d.series[i - 1].date, p.date) > 1) ? `Semana de ${fmtShort(p.date)}` : fmtDate(p.date),
    a: p.receitas,
    b: p.despesas,
  }));

  const firstName = user?.name.split(' ')[0] ?? '';
  const isEmpty = data.transactions.length === 0;

  return (
    <Screen
      title={`Olá, ${firstName}`}
      subtitle={`Resumo de ${fmtDate(period.period.from)} a ${fmtDate(period.period.to)}`}
      actions={<PeriodPicker value={period} onChange={setPeriod} />}
    >
      {isEmpty ? (
        <Panel>
          <EmptyState
            icon="feather"
            title="Comece pelo primeiro lançamento"
            message="Cadastre suas contas e cartões e lance receitas e despesas. O resumo aparece aqui automaticamente."
            action={
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button label="Cadastrar conta" variant="secondary" onPress={() => router.navigate('/contas')} />
                <Button label="Novo lançamento" icon="plus" onPress={() => editor.create()} />
              </View>
            }
          />
        </Panel>
      ) : null}

      {/* Indicadores principais */}
      <View style={styles.kpis}>
        <View style={[styles.hero, { flexBasis: isWide ? 0 : '100%' }]}>
          <T variant="label" color={colors.sidebarMuted}>Saldo em contas</T>
          <Money variant="display" value={d.balance} color={colors.sidebarInk} />
          <T variant="caption" color={colors.sidebarMuted}>
            Hoje, somando {data.accounts.filter((a) => !a.archived).length} conta(s)
          </T>
        </View>
        <Kpi
          label="Receitas recebidas"
          value={d.received}
          tone="income"
          foot={d.toReceiveInPeriod ? `+ ${fmtMoney(d.toReceiveInPeriod)} ainda a receber no período` : 'Nada pendente no período'}
          wide={isMedium}
        />
        <Kpi
          label="Despesas pagas"
          value={d.paid}
          foot={d.toPayInPeriod ? `${fmtMoney(d.toPayInPeriod)} ainda a pagar no período` : 'Nada pendente no período'}
          wide={isMedium}
        />
        <Kpi label="Resultado do período" value={d.result} tone="auto" signed foot="Recebido menos pago (caixa)" wide={isMedium} />
        <Kpi
          label="Faturas a pagar"
          value={d.openInvoicesTotal}
          foot={d.nextInvoice ? `Próxima: ${d.nextInvoice.card.name}, ${fmtShort(d.nextInvoice.invoice.dueDate)}` : 'Nenhuma fatura em aberto'}
          wide={isMedium}
        />
      </View>

      {d.overdue.count > 0 ? (
        <Pressable onPress={() => router.navigate('/lancamentos?status=vencido' as never)} style={styles.alert}>
          <Icon name="alert-triangle" size={16} color={colors.expense} />
          <T variant="small" color={colors.expense} style={{ flex: 1 }}>
            {d.overdue.count} lançamento(s) vencido(s): {fmtMoney(d.overdue.payable)} a pagar
            {d.overdue.receivable ? ` e ${fmtMoney(d.overdue.receivable)} a receber` : ''}.
          </T>
          <T variant="small" weight="semibold" color={colors.expense}>Ver</T>
        </Pressable>
      ) : null}

      <View style={[styles.cols, !isWide && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={{ flex: 2, gap: 20, minWidth: 0 }}>
          <Panel title="Próximos 7 dias" action={<T variant="caption" color={colors.ink3}>Lançamentos em aberto</T>}>
            <View style={styles.provisions}>
              <Provision label="A receber" value={d.next7.receivable} icon="arrow-down-left" tone={colors.income} />
              <Provision label="A pagar" value={d.next7.payable} icon="arrow-up-right" tone={colors.expense} />
              <Provision label="Saldo projetado" value={d.balance + d.next7.receivable - d.next7.payable} icon="trending-up" tone={colors.ink} />
            </View>
            {d.next7.items.length ? (
              <View style={{ marginHorizontal: -18, marginBottom: -18 }}>
                {d.next7.items.slice(0, 8).map((item) => <UpcomingRow key={item.id} item={item} />)}
              </View>
            ) : (
              <T variant="small" color={colors.ink3}>Nenhum vencimento nos próximos 7 dias.</T>
            )}
          </Panel>

          <Panel title="Fluxo de caixa" action={<T variant="caption" color={colors.ink3}>{d.series.length > 31 ? 'Por semana' : 'Por dia'} · realizado</T>}>
            <PairedBars data={chartData} aLabel="Receitas" bLabel="Despesas" />
          </Panel>
        </View>

        <View style={{ flex: 1, gap: 20, minWidth: 0 }}>
          <Panel title="Faturas" action={<Link label="Cartões" href="/cartoes" />}>
            {data.cards.filter((c) => !c.archived).length === 0 ? (
              <T variant="small" color={colors.ink3}>Nenhum cartão cadastrado.</T>
            ) : (
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T variant="small" color={colors.ink3}>Em aberto e fechadas</T>
                  <Money variant="h2" value={d.openInvoicesTotal} />
                </View>
                {data.cards
                  .filter((c) => !c.archived)
                  .map((card) => {
                    const invoices = data.invoicesByCard.get(card.id) ?? [];
                    const current = invoices.find((i) => i.status === 'fechada') ?? invoices.find((i) => i.status === 'aberta');
                    const used = invoices.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);
                    return (
                      <Pressable key={card.id} onPress={() => router.navigate(`/cartoes/${card.id}` as never)} style={styles.cardRow}>
                        <View style={[styles.cardChip, { backgroundColor: card.color }]} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                            <T variant="small" weight="medium" numberOfLines={1} style={{ flex: 1 }}>{card.name}</T>
                            <Money variant="small" weight="semibold" value={current ? current.total - current.paid : 0} />
                          </View>
                          <Meter value={card.limit ? used / card.limit : 0} color={card.color} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <T variant="caption" color={colors.ink3}>
                              {current ? `${INVOICE_STATUS_LABEL[current.status]} · vence ${fmtShort(current.dueDate)}` : 'Sem fatura'}
                            </T>
                            <T variant="caption" color={colors.ink3} tabular>Livre {fmtMoney(Math.max(0, card.limit - used))}</T>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                <View style={styles.subtle}>
                  <T variant="caption" color={colors.ink3}>Compras no cartão no período</T>
                  <Money variant="small" weight="medium" value={d.cardSpending} />
                </View>
              </View>
            )}
          </Panel>

          <Panel title="Contas" action={<Link label="Gerenciar" href="/contas" />}>
            {data.accounts.filter((a) => !a.archived).map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.dot, { backgroundColor: a.color }]} />
                <T variant="small" style={{ flex: 1 }}>{a.name}</T>
                <Money variant="small" weight="medium" value={accountBalance(a, data.transactions, data.invoicePayments)} />
              </View>
            ))}
            {data.accounts.length === 0 ? <T variant="small" color={colors.ink3}>Nenhuma conta cadastrada.</T> : null}
          </Panel>

          <Panel title="Onde você gastou" action={<Link label="Relatórios" href="/relatorios" />}>
            {byCategory.length ? (
              <RankBars
                rows={byCategory.map((c) => {
                  const cat = data.categoryById.get(c.categoryId);
                  return { key: c.categoryId, label: cat?.name ?? 'Sem categoria', value: c.total, swatch: cat?.color };
                })}
              />
            ) : (
              <T variant="small" color={colors.ink3}>Sem despesas no período.</T>
            )}
            <T variant="caption" color={colors.ink3}>Pela data de lançamento, incluindo cartão.</T>
          </Panel>
        </View>
      </View>
    </Screen>
  );
}

function Kpi({ label, value, foot, tone = 'neutral', signed, wide }: { label: string; value: number; foot: string; tone?: 'neutral' | 'income' | 'auto'; signed?: boolean; wide: boolean }) {
  return (
    <View style={[styles.kpi, wide ? { flexBasis: 0 } : { flexBasis: '40%', minWidth: 150, padding: 14 }]}>
      <T variant="label" color={colors.ink3}>{label}</T>
      <Money variant={wide ? 'h1' : 'h2'} value={value} tone={tone} signed={signed} />
      <T variant="caption" color={colors.ink3}>{foot}</T>
    </View>
  );
}

function Provision({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: string }) {
  return (
    <View style={styles.provision}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={14} color={tone} />
        <T variant="small" color={colors.ink3}>{label}</T>
      </View>
      <Money variant="h2" value={value} />
    </View>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const editor = useEditor();
  const days = diffDays(today(), item.dueDate);
  const when = days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`;
  const isIncome = item.kind === 'receita';
  const { isMedium } = useLayout();
  const act = () => {
    if (item.transaction) editor.settle(item.transaction);
    else if (item.card && item.invoice) editor.payInvoice(item.card, item.invoice);
  };
  return (
    <Pressable style={styles.upcoming} onPress={isMedium ? undefined : act} disabled={isMedium}>
      <View style={styles.when}>
        <T variant="small" weight="semibold" tabular>{fmtShort(item.dueDate)}</T>
        <T variant="caption" color={colors.ink3}>{when}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T weight="medium" numberOfLines={1}>{item.description}</T>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Badge label={item.kind === 'fatura' ? 'Fatura' : isIncome ? 'Receita' : 'Despesa'} tone={item.kind === 'fatura' ? 'info' : isIncome ? 'income' : 'neutral'} />
        </View>
      </View>
      <Money value={isIncome ? item.amount : -item.amount} tone={isIncome ? 'income' : 'neutral'} signed weight="medium" />
      {isMedium ? (
        <Button size="sm" variant="secondary" label={isIncome ? 'Receber' : 'Pagar'} onPress={act} />
      ) : (
        <Icon name="chevron-right" size={16} color={colors.ink3} />
      )}
    </Pressable>
  );
}

function Link({ label, href }: { label: string; href: string }) {
  return (
    <Pressable onPress={() => router.navigate(href as never)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <T variant="small" color={colors.ink2} weight="medium">{label}</T>
      <Icon name="chevron-right" size={14} color={colors.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hero: {
    flexGrow: 1.3,
    minWidth: 220,
    backgroundColor: colors.sidebar,
    borderRadius: radius.lg,
    padding: 18,
    gap: 6,
  },
  kpi: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 6,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.expenseSoft,
  },
  cols: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  provisions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  provision: {
    flexGrow: 1,
    flexBasis: 140,
    gap: 4,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
  },
  upcoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  when: { width: 56 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardChip: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subtle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
