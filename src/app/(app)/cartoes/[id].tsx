import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { fmtDate, fmtRef, fmtRefLong } from '@/domain/dates';
import { cardUsedLimit } from '@/domain/finance';
import { INVOICE_STATUS_LABEL } from '@/domain/labels';
import { fmtMoney } from '@/domain/money';
import type { InvoiceStatus } from '@/domain/types';
import { CardForm } from '@/features/CardForm';
import { CardVisual } from '@/features/CardVisual';
import { useEditor } from '@/features/Editor';
import { TransactionRow } from '@/features/TransactionRow';
import { useData } from '@/state/data';
import { Button, Chip, IconButton } from '@/ui/controls';
import { Badge, EmptyState, Panel, Screen, type BadgeTone } from '@/ui/layout';
import { useConfirm, useToast } from '@/ui/overlay';
import { Money, T } from '@/ui/Text';
import { colors, radius, useLayout } from '@/ui/theme';

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = { aberta: 'info', fechada: 'warn', paga: 'income', futura: 'neutral' };

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const editor = useEditor();
  const confirm = useConfirm();
  const toast = useToast();
  const { isWide } = useLayout();
  const card = data.cardById.get(id);
  const invoices = useMemo(() => data.invoicesByCard.get(id) ?? [], [data.invoicesByCard, id]);
  const [ref, setRef] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (ref && invoices.some((i) => i.ref === ref)) return;
    const pick = invoices.find((i) => i.status === 'fechada') ?? invoices.find((i) => i.status === 'aberta') ?? invoices[0];
    setRef(pick?.ref ?? null);
  }, [invoices, ref]);

  if (!card) {
    return (
      <Screen title="Cartão não encontrado">
        <Panel>
          <EmptyState icon="credit-card" title="Este cartão não existe ou foi excluído." action={<Button label="Voltar para cartões" onPress={() => router.navigate('/cartoes')} />} />
        </Panel>
      </Screen>
    );
  }

  const invoice = invoices.find((i) => i.ref === ref) ?? null;
  const open = invoice ? invoice.total - invoice.paid : 0;

  return (
    <Screen
      title={card.name}
      subtitle={`Fecha dia ${card.closingDay} · vence dia ${card.dueDay}`}
      actions={
        <>
          <Button label="Cartões" variant="ghost" icon="arrow-left" onPress={() => router.navigate('/cartoes')} />
          <Button label="Editar" variant="secondary" icon="edit-2" onPress={() => setEditing(true)} />
          <Button label="Nova compra" icon="plus" onPress={() => editor.create({ kind: 'despesa', cardId: card.id })} />
        </>
      }
    >
      <View style={[{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }, !isWide && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={{ width: isWide ? 340 : '100%', gap: 16 }}>
          <CardVisual card={card} used={cardUsedLimit(invoices)} />
          {invoice ? (
            <Panel>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T variant="title" weight="semibold">{fmtRefLong(invoice.ref)}</T>
                <Badge label={INVOICE_STATUS_LABEL[invoice.status]} tone={STATUS_TONE[invoice.status]} />
              </View>
              <Money variant="display" value={invoice.total} />
              <View style={{ gap: 6 }}>
                <Line label="Fechamento" value={fmtDate(invoice.closingDate)} />
                <Line label="Vencimento" value={fmtDate(invoice.dueDate)} />
                <Line label="Pago" value={fmtMoney(invoice.paid)} />
                <Line label="Em aberto" value={fmtMoney(Math.max(0, open))} strong />
              </View>
              {open > 0 ? (
                <Button
                  label={invoice.status === 'aberta' || invoice.status === 'futura' ? 'Antecipar pagamento' : 'Pagar fatura'}
                  variant={invoice.status === 'fechada' ? 'primary' : 'secondary'}
                  onPress={() => editor.payInvoice(card, invoice)}
                  full
                />
              ) : null}
              {invoice.payments.length ? (
                <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
                  <T variant="label" color={colors.ink3}>Pagamentos</T>
                  {invoice.payments.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <T variant="small" weight="medium">{fmtDate(p.paidAt)}</T>
                        <T variant="caption" color={colors.ink3}>{data.accountById.get(p.accountId)?.name ?? 'Conta removida'}</T>
                      </View>
                      <Money variant="small" value={p.amount} />
                      <IconButton
                        icon="x"
                        label="Estornar pagamento"
                        onPress={async () => {
                          const ok = await confirm({ title: 'Estornar pagamento?', message: `O pagamento de ${fmtMoney(p.amount)} será removido e o valor volta para a conta.`, confirmLabel: 'Estornar', destructive: true });
                          if (ok) {
                            await data.deleteInvoicePayment(p.id);
                            toast('Pagamento estornado');
                          }
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </Panel>
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {invoices.map((i) => (
              <Chip
                key={i.ref}
                label={`${fmtRef(i.ref)}${i.status === 'paga' ? ' ✓' : i.status === 'fechada' ? ' •' : ''}`}
                selected={i.ref === ref}
                onPress={() => setRef(i.ref)}
              />
            ))}
          </ScrollView>
          <Panel padded={false}>
            <View style={styles.listHead}>
              <T variant="title" weight="semibold">Lançamentos da fatura</T>
              <T variant="small" color={colors.ink3}>{invoice?.items.length ?? 0} item(ns)</T>
            </View>
            {invoice && invoice.items.length ? (
              invoice.items.map((t) => <TransactionRow key={t.id} t={t} dateField="launchDate" compact />)
            ) : (
              <EmptyState icon="shopping-bag" title="Nenhuma compra nesta fatura" />
            )}
          </Panel>
        </View>
      </View>
      <CardForm visible={editing} card={card} onClose={() => setEditing(false)} />
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T variant="small" color={colors.ink3}>{label}</T>
      <T variant="small" weight={strong ? 'semibold' : 'regular'} tabular>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  listHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
