import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { fmtDate, fmtRefLong, today } from '@/domain/dates';
import { fmtMoney } from '@/domain/money';
import type { CreditCard, EntryKind, Invoice, Transaction } from '@/domain/types';
import { useData, type SeriesScope } from '@/state/data';
import { Button } from '@/ui/controls';
import { DateField, MoneyField, Row, Select } from '@/ui/fields';
import { Sheet, useConfirm, useToast } from '@/ui/overlay';
import { T } from '@/ui/Text';
import { colors } from '@/ui/theme';
import { accountOptions } from './options';
import { TransactionSheet } from './TransactionSheet';

interface EditorApi {
  create(preset?: { kind?: EntryKind; cardId?: string }): void;
  edit(t: Transaction): void;
  settle(t: Transaction): void;
  reopen(t: Transaction): Promise<void>;
  remove(t: Transaction): Promise<void>;
  payInvoice(card: CreditCard, invoice: Invoice): void;
}

const EditorContext = createContext<EditorApi | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor fora do EditorProvider');
  return ctx;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const data = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [txSheet, setTxSheet] = useState<{ editing?: Transaction; preset?: { kind?: EntryKind; cardId?: string } } | null>(null);
  const [paying, setPaying] = useState<Transaction | null>(null);
  const [invoicePay, setInvoicePay] = useState<{ card: CreditCard; invoice: Invoice } | null>(null);

  const remove = useCallback(
    async (t: Transaction) => {
      const inSeries = !!t.seriesId && data.seriesOf(t).length > 1;
      const choice = await confirm({
        title: 'Excluir lançamento?',
        message: inSeries
          ? `"${t.description}" faz parte de uma série (${t.seriesIndex}/${t.seriesTotal}). Esta ação não pode ser desfeita.`
          : `"${t.description}" de ${fmtMoney(t.amount)} será removido. Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir',
        destructive: true,
        choices: inSeries
          ? [
              { value: 'one', label: 'Somente este' },
              { value: 'following', label: 'Este e os próximos' },
              { value: 'all', label: 'Todos da série' },
            ]
          : undefined,
      });
      if (!choice) return;
      await data.deleteTransaction(t.id, inSeries ? (choice as SeriesScope) : 'one');
      toast('Lançamento excluído');
    },
    [data, confirm, toast],
  );

  const reopen = useCallback(
    async (t: Transaction) => {
      await data.reopen(t.id);
      toast(t.kind === 'receita' ? 'Recebimento desfeito' : 'Pagamento desfeito');
    },
    [data, toast],
  );

  const api = useMemo<EditorApi>(
    () => ({
      create: (preset) => setTxSheet({ preset }),
      edit: (t) => setTxSheet({ editing: t }),
      settle: (t) => setPaying(t),
      reopen,
      remove,
      payInvoice: (card, invoice) => setInvoicePay({ card, invoice }),
    }),
    [remove, reopen],
  );

  return (
    <EditorContext.Provider value={api}>
      {children}
      <TransactionSheet
        visible={!!txSheet}
        onClose={() => setTxSheet(null)}
        editing={txSheet?.editing ?? null}
        preset={txSheet?.preset}
      />
      <SettleSheet transaction={paying} onClose={() => setPaying(null)} />
      <InvoicePaySheet target={invoicePay} onClose={() => setInvoicePay(null)} />
    </EditorContext.Provider>
  );
}

function SettleSheet({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  const data = useData();
  const toast = useToast();
  const [paidAt, setPaidAt] = useState(today());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setPaidAt(today());
    setAccountId(transaction.accountId ?? data.accounts[0]?.id ?? null);
    setAmount(transaction.amount);
  }, [transaction, data.accounts]);

  if (!transaction) return null;
  const isIncome = transaction.kind === 'receita';
  const diff = (amount ?? 0) - transaction.amount;

  const save = async () => {
    if (!accountId || !amount) return;
    setSaving(true);
    await data.settle(transaction.id, { paidAt, accountId, paidAmount: amount });
    setSaving(false);
    toast(isIncome ? 'Recebimento registrado' : 'Pagamento registrado');
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={isIncome ? 'Registrar recebimento' : 'Registrar pagamento'}
      subtitle={`${transaction.description} · vence ${fmtDate(transaction.dueDate)}`}
      width={480}
      footer={
        <>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label={isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'} variant={isIncome ? 'income' : 'primary'} onPress={save} loading={saving} disabled={!accountId || !amount} />
        </>
      }
    >
      <Row>
        <DateField label={isIncome ? 'Recebido em' : 'Pago em'} value={paidAt} onChange={setPaidAt} />
        <MoneyField label="Valor efetivo" value={amount} onChange={setAmount} />
      </Row>
      <Select label="Conta" value={accountId} options={accountOptions(data.accounts, accountId)} onChange={setAccountId} />
      {diff !== 0 && amount ? (
        <T variant="small" color={colors.ink3}>
          {diff > 0 ? 'Acréscimo' : 'Desconto'} de {fmtMoney(Math.abs(diff))} em relação ao previsto.
        </T>
      ) : null}
    </Sheet>
  );
}

function InvoicePaySheet({ target, onClose }: { target: { card: CreditCard; invoice: Invoice } | null; onClose: () => void }) {
  const data = useData();
  const toast = useToast();
  const [paidAt, setPaidAt] = useState(today());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setPaidAt(today());
    setAccountId(target.card.defaultAccountId ?? data.accounts[0]?.id ?? null);
    setAmount(Math.max(0, target.invoice.total - target.invoice.paid));
  }, [target, data.accounts]);

  if (!target) return null;
  const { card, invoice } = target;
  const open = invoice.total - invoice.paid;

  const save = async () => {
    if (!accountId || !amount) return;
    setSaving(true);
    await data.payInvoice(card.id, invoice.ref, { paidAt, accountId, amount });
    setSaving(false);
    toast(amount >= open ? 'Fatura paga' : 'Pagamento parcial registrado');
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Pagar fatura"
      subtitle={`${card.name} · ${fmtRefLong(invoice.ref)} · vence ${fmtDate(invoice.dueDate)}`}
      width={480}
      footer={
        <>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label="Confirmar pagamento" onPress={save} loading={saving} disabled={!accountId || !amount} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T color={colors.ink3}>Em aberto</T>
        <T weight="semibold" tabular>{fmtMoney(open)}</T>
      </View>
      <Row>
        <DateField label="Pago em" value={paidAt} onChange={setPaidAt} />
        <MoneyField label="Valor pago" value={amount} onChange={setAmount} hint={amount != null && amount < open ? 'Pagamento parcial' : undefined} />
      </Row>
      <Select label="Conta de saída" value={accountId} options={accountOptions(data.accounts, accountId)} onChange={setAccountId} />
    </Sheet>
  );
}
