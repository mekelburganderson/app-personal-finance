import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FREQUENCY_LABEL, fmtDate, fmtRefLong, fmtShort } from '@/domain/dates';
import { PAYMENT_LABEL } from '@/domain/labels';
import { fmtMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types';
import { useData, useTransactionStatus } from '@/state/data';
import { Button, Icon } from '@/ui/controls';
import { Badge, Divider } from '@/ui/layout';
import { Sheet } from '@/ui/overlay';
import { Money, T } from '@/ui/Text';
import { colors, useLayout } from '@/ui/theme';
import { useEditor } from './Editor';

export function StatusBadge({ status, kind }: { status: 'pago' | 'aberto' | 'vencido'; kind: Transaction['kind'] }) {
  if (status === 'pago') return <Badge label={kind === 'receita' ? 'Recebido' : 'Pago'} tone="income" />;
  if (status === 'vencido') return <Badge label="Vencido" tone="expense" />;
  return <Badge label="Em aberto" tone="neutral" />;
}

export function TransactionRow({ t, dateField = 'dueDate', compact }: { t: Transaction; dateField?: 'dueDate' | 'launchDate'; compact?: boolean }) {
  const data = useData();
  const editor = useEditor();
  const statusOf = useTransactionStatus();
  const { isMedium } = useLayout();
  const [open, setOpen] = useState(false);
  const status = statusOf(t);
  const category = t.categoryId ? data.categoryById.get(t.categoryId) : undefined;
  const sub = t.subcategoryId ? data.categoryById.get(t.subcategoryId) : undefined;
  const card = t.cardId ? data.cardById.get(t.cardId) : undefined;
  const account = t.accountId ? data.accountById.get(t.accountId) : undefined;
  const canSettle = !t.cardId && t.status === 'aberto';

  const meta = [
    category ? (sub ? `${category.name} › ${sub.name}` : category.name) : 'Sem categoria',
    card ? card.name : account?.name,
  ].filter(Boolean);

  return (
    <>
      <View style={styles.row}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ hovered }) => [styles.rowMain, hovered && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel={`${t.description}, ${fmtMoney(t.amount)}`}
      >
        <View style={[styles.marker, { backgroundColor: category?.color ?? colors.lineStrong }]} />
        <View style={styles.date}>
          <T variant="small" weight="medium" tabular>{fmtShort(t[dateField])}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{t.description}</T>
            {t.seriesTotal > 1 ? (
              <T variant="caption" color={colors.ink3} tabular>
                {t.seriesIndex}/{t.seriesTotal}
              </T>
            ) : null}
            {t.cardId ? <Icon name="credit-card" size={13} color={colors.ink3} /> : null}
            {t.seriesType === 'recorrente' ? <Icon name="repeat" size={13} color={colors.ink3} /> : null}
          </View>
          <T variant="caption" color={colors.ink3} numberOfLines={1}>{meta.join(' · ')}</T>
        </View>
        {isMedium && !compact ? <StatusBadge status={status} kind={t.kind} /> : null}
        <View style={{ alignItems: 'flex-end', minWidth: 96 }}>
          <Money value={t.kind === 'receita' ? t.amount : -t.amount} tone={t.kind === 'receita' ? 'income' : 'neutral'} signed weight="medium" />
          {!isMedium || compact ? (
            <T variant="caption" color={status === 'vencido' ? colors.expense : colors.ink3}>
              {status === 'pago' ? (t.kind === 'receita' ? 'Recebido' : 'Pago') : status === 'vencido' ? 'Vencido' : 'Em aberto'}
            </T>
          ) : null}
        </View>
      </Pressable>
        {canSettle && isMedium ? (
          <Button
            size="sm"
            variant="secondary"
            label={t.kind === 'receita' ? 'Receber' : 'Pagar'}
            onPress={() => editor.settle(t)}
            style={{ marginLeft: 4 }}
          />
        ) : null}
      </View>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t.description}
        subtitle={t.seriesTotal > 1 ? `${t.seriesType === 'parcelado' ? 'Parcela' : 'Ocorrência'} ${t.seriesIndex} de ${t.seriesTotal}` : undefined}
        width={500}
        footer={
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
            <Button label="Excluir" variant="ghost" icon="trash-2" onPress={() => { setOpen(false); editor.remove(t); }} />
            <Button label="Editar" variant="secondary" icon="edit-2" onPress={() => { setOpen(false); editor.edit(t); }} />
            {canSettle ? (
              <Button
                label={t.kind === 'receita' ? 'Receber' : 'Pagar'}
                variant={t.kind === 'receita' ? 'income' : 'primary'}
                icon="check"
                onPress={() => { setOpen(false); editor.settle(t); }}
              />
            ) : !t.cardId && t.status === 'pago' ? (
              <Button label="Desfazer pagamento" variant="secondary" icon="rotate-ccw" onPress={() => { setOpen(false); editor.reopen(t); }} />
            ) : null}
          </View>
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <Money variant="display" value={t.kind === 'receita' ? t.amount : -t.amount} tone={t.kind === 'receita' ? 'income' : 'neutral'} signed />
          <StatusBadge status={status} kind={t.kind} />
        </View>
        <Divider />
        <Detail label="Categoria" value={category ? (sub ? `${category.name} › ${sub.name}` : category.name) : '—'} />
        <Detail label="Forma de pagamento" value={PAYMENT_LABEL[t.paymentMethod]} />
        {card ? (
          <>
            <Detail label="Cartão" value={`${card.name} •••• ${card.lastDigits}`} />
            <Detail label="Fatura" value={t.invoiceRef ? fmtRefLong(t.invoiceRef) : '—'} />
          </>
        ) : (
          <Detail label="Conta" value={account?.name ?? '—'} />
        )}
        <Detail label={card ? 'Data da compra' : 'Data de lançamento'} value={fmtDate(t.launchDate)} />
        <Detail label="Vencimento" value={fmtDate(t.dueDate)} />
        {t.status === 'pago' && !card ? (
          <Detail label={t.kind === 'receita' ? 'Recebido em' : 'Pago em'} value={`${fmtDate(t.paidAt)} · ${fmtMoney(t.paidAmount ?? t.amount)}`} />
        ) : null}
        {t.seriesType === 'recorrente' && t.frequency ? <Detail label="Recorrência" value={FREQUENCY_LABEL[t.frequency]} /> : null}
        {t.notes ? <Detail label="Observações" value={t.notes} /> : null}
        {card ? (
          <T variant="caption" color={colors.ink3}>Itens de cartão são quitados ao pagar a fatura.</T>
        ) : null}
      </Sheet>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <T variant="small" color={colors.ink3}>{label}</T>
      <T variant="small" weight="medium" align="right" style={{ flexShrink: 1 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  marker: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  date: { width: 48 },
});
