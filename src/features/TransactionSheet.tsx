import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TransactionDraft } from '@/data/factory';
import { FREQUENCY_LABEL, fmtDate, fmtRef, today } from '@/domain/dates';
import { buildSeries, countOccurrencesUntil, invoiceDates, invoiceRefForDate } from '@/domain/finance';
import { PAYMENT_LABEL } from '@/domain/labels';
import { fmtMoney } from '@/domain/money';
import type { EntryKind, Frequency, PaymentMethod, SeriesType, Transaction } from '@/domain/types';
import { useData, type SeriesScope, type TransactionPatch } from '@/state/data';
import { Button, Chip, Segmented, Toggle } from '@/ui/controls';
import { DateField, MoneyField, Row, Select, TextField } from '@/ui/fields';
import { Divider } from '@/ui/layout';
import { Sheet, useConfirm, useToast } from '@/ui/overlay';
import { T } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';
import { accountOptions, cardOptions, categoryOptions, invoiceOptions, subcategoryOptions } from './options';

const METHODS: PaymentMethod[] = ['pix', 'cartao_credito', 'boleto', 'debito', 'dinheiro', 'transferencia', 'debito_automatico'];
const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as Frequency[];

export interface TransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Lançamento existente para edição. */
  editing?: Transaction | null;
  /** Valores iniciais para um novo lançamento. */
  preset?: { kind?: EntryKind; cardId?: string };
}

interface FormState {
  kind: EntryKind;
  description: string;
  amount: number | null;
  amountMode: 'total' | 'parcela';
  seriesType: SeriesType;
  installments: string;
  frequency: Frequency;
  endMode: 'count' | 'date';
  occurrences: string;
  untilDate: string;
  launchDate: string;
  dueDate: string;
  dueTouched: boolean;
  paymentMethod: PaymentMethod;
  accountId: string | null;
  cardId: string | null;
  invoiceRef: string | null;
  invoiceTouched: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
  notes: string;
  settled: boolean;
}

export function TransactionSheet({ visible, onClose, editing, preset }: TransactionSheetProps) {
  const data = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(() => initialState());
  const [overrides, setOverrides] = useState<{ dueDate?: string; amount?: number }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function initialState(): FormState {
    const t = today();
    const firstAccount = data.accounts.find((a) => !a.archived)?.id ?? null;
    if (editing) {
      return {
        kind: editing.kind,
        description: editing.description,
        amount: editing.amount,
        amountMode: 'parcela',
        seriesType: editing.seriesType,
        installments: String(editing.seriesTotal),
        frequency: editing.frequency ?? 'mensal',
        endMode: 'count',
        occurrences: String(editing.seriesTotal),
        untilDate: editing.dueDate,
        launchDate: editing.launchDate,
        dueDate: editing.dueDate,
        dueTouched: true,
        paymentMethod: editing.paymentMethod,
        accountId: editing.accountId,
        cardId: editing.cardId,
        invoiceRef: editing.invoiceRef,
        invoiceTouched: true,
        categoryId: editing.categoryId,
        subcategoryId: editing.subcategoryId,
        notes: editing.notes,
        settled: false,
      };
    }
    const cardId = preset?.cardId ?? null;
    const card = cardId ? data.cardById.get(cardId) : undefined;
    return {
      kind: preset?.kind ?? 'despesa',
      description: '',
      amount: null,
      amountMode: 'total',
      seriesType: 'unico',
      installments: '2',
      frequency: 'mensal',
      endMode: 'count',
      occurrences: '12',
      untilDate: t,
      launchDate: t,
      dueDate: t,
      dueTouched: false,
      paymentMethod: cardId ? 'cartao_credito' : 'pix',
      accountId: card?.defaultAccountId ?? firstAccount,
      cardId,
      invoiceRef: card ? invoiceRefForDate(card, t) : null,
      invoiceTouched: false,
      categoryId: null,
      subcategoryId: null,
      notes: '',
      settled: false,
    };
  }

  useEffect(() => {
    if (visible) {
      setForm(initialState());
      setOverrides([]);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const isCard = form.paymentMethod === 'cartao_credito';
  const card = form.cardId ? data.cardById.get(form.cardId) ?? null : null;
  const isEdit = !!editing;
  const inSeries = !!editing?.seriesId;

  // Mantém a fatura sugerida em sincronia com a data, até o usuário escolher outra.
  useEffect(() => {
    if (isCard && card && !form.invoiceTouched) set('invoiceRef', invoiceRefForDate(card, form.launchDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCard, card?.id, form.launchDate, form.invoiceTouched]);

  const occurrences = useMemo(() => {
    if (form.seriesType !== 'recorrente') return 1;
    if (form.endMode === 'date') return countOccurrencesUntil(form.dueDate, form.frequency, form.untilDate, 120);
    return Number(form.occurrences) || 0;
  }, [form.seriesType, form.endMode, form.dueDate, form.frequency, form.untilDate, form.occurrences]);

  const preview = useMemo(() => {
    if (isEdit || form.seriesType === 'unico' || !form.amount) return [];
    return buildSeries({
      seriesType: form.seriesType,
      amount: form.amount,
      amountMode: form.amountMode,
      installments: Math.min(120, Number(form.installments) || 0),
      frequency: form.frequency,
      occurrences: Math.min(120, occurrences),
      launchDate: form.launchDate,
      firstDueDate: form.dueDate,
      card: isCard ? card : null,
      firstInvoiceRef: isCard ? form.invoiceRef : null,
    });
  }, [isEdit, form, occurrences, isCard, card]);

  // Ajustes manuais deixam de valer quando os parâmetros da série mudam.
  const previewKey = `${form.seriesType}|${form.amount}|${form.amountMode}|${form.installments}|${occurrences}|${form.frequency}|${form.dueDate}|${form.invoiceRef}|${isCard}`;
  useEffect(() => setOverrides([]), [previewKey]);

  const previewTotal = preview.reduce((s, p, i) => s + (overrides[i]?.amount ?? p.amount), 0);

  const changeKind = (kind: EntryKind) =>
    setForm((f) => ({
      ...f,
      kind,
      categoryId: null,
      subcategoryId: null,
      paymentMethod: kind === 'receita' && f.paymentMethod === 'cartao_credito' ? 'pix' : f.paymentMethod,
    }));

  const changeMethod = (m: PaymentMethod) =>
    setForm((f) => {
      const next = { ...f, paymentMethod: m };
      if (m === 'cartao_credito') {
        const c = (f.cardId && data.cardById.get(f.cardId)) || data.cards.find((x) => !x.archived);
        next.cardId = c?.id ?? null;
        next.invoiceTouched = false;
        if (f.seriesType === 'recorrente') next.seriesType = 'unico';
      }
      return next;
    });

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Descreva o lançamento.';
    if (!form.amount || form.amount <= 0) e.amount = 'Informe um valor maior que zero.';
    if (!form.categoryId) e.categoryId = 'Escolha uma categoria.';
    if (isCard && !form.cardId) e.cardId = data.cards.length ? 'Escolha o cartão.' : 'Cadastre um cartão primeiro.';
    if (!isCard && !form.accountId) e.accountId = data.accounts.length ? 'Escolha a conta.' : 'Cadastre uma conta primeiro.';
    if (!isCard && form.dueDate < form.launchDate) e.dueDate = 'O vencimento não pode ser antes do lançamento.';
    if (!isEdit && form.seriesType === 'parcelado') {
      const n = Number(form.installments);
      if (!Number.isInteger(n) || n < 2 || n > 120) e.installments = 'Entre 2 e 120 parcelas.';
    }
    if (!isEdit && form.seriesType === 'recorrente' && (occurrences < 2 || occurrences > 120)) {
      e.occurrences = 'A recorrência deve gerar entre 2 e 120 lançamentos.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        let scope: SeriesScope = 'one';
        if (inSeries) {
          const choice = await confirm({
            title: 'Aplicar alteração em…',
            message: 'Este lançamento faz parte de uma série. Datas são alteradas apenas neste item.',
            confirmLabel: 'Salvar',
            choices: [
              { value: 'one', label: 'Somente este lançamento' },
              { value: 'following', label: 'Este e os próximos', hint: `A partir de ${editing.seriesIndex}/${editing.seriesTotal}` },
              { value: 'all', label: 'Todos da série' },
            ],
          });
          if (!choice) return;
          scope = choice as SeriesScope;
        }
        const patch: TransactionPatch = {
          description: form.description.trim(),
          amount: form.amount!,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId,
          launchDate: form.launchDate,
          paymentMethod: form.paymentMethod,
          notes: form.notes.trim(),
        };
        if (isCard && card && form.invoiceRef) {
          Object.assign(patch, {
            cardId: card.id,
            invoiceRef: form.invoiceRef,
            dueDate: invoiceDates(card, form.invoiceRef).dueDate,
            accountId: card.defaultAccountId,
          });
        } else {
          Object.assign(patch, { cardId: null, invoiceRef: null, dueDate: form.dueDate, accountId: form.accountId });
        }
        await data.updateTransaction(editing.id, patch, scope);
        toast('Lançamento atualizado');
      } else {
        const draft: TransactionDraft = {
          kind: form.kind,
          description: form.description,
          amount: form.amount!,
          amountMode: form.amountMode,
          seriesType: form.seriesType,
          installments: Number(form.installments) || 1,
          frequency: form.frequency,
          occurrences,
          launchDate: form.launchDate,
          firstDueDate: form.dueDate,
          paymentMethod: form.paymentMethod,
          accountId: form.accountId,
          cardId: isCard ? form.cardId : null,
          firstInvoiceRef: isCard ? form.invoiceRef : null,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId,
          notes: form.notes,
          overrides,
        };
        const paidFirst =
          form.settled && !isCard && form.accountId
            ? { paidAt: form.dueDate > today() ? today() : form.dueDate, accountId: form.accountId }
            : null;
        const list = await data.createTransactions(draft, paidFirst);
        toast(list.length > 1 ? `${list.length} lançamentos criados` : 'Lançamento criado');
      }
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  const kindColor = form.kind === 'receita' ? colors.income : colors.expense;
  const title = isEdit
    ? `Editar ${form.kind}`
    : form.kind === 'receita'
      ? 'Nova receita'
      : 'Nova despesa';
  const subtitle = editing && editing.seriesTotal > 1
    ? `${editing.seriesType === 'parcelado' ? 'Parcela' : 'Ocorrência'} ${editing.seriesIndex} de ${editing.seriesTotal}`
    : undefined;

  const methods = form.kind === 'receita' ? METHODS.filter((m) => m !== 'cartao_credito') : METHODS;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      width={640}
      footer={
        <>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label={isEdit ? 'Salvar alterações' : 'Lançar'} onPress={save} loading={saving} variant={form.kind === 'receita' ? 'income' : 'primary'} />
        </>
      }
    >
      {!isEdit ? (
        <Segmented
          value={form.kind}
          onChange={changeKind}
          options={[
            { value: 'despesa', label: 'Despesa' },
            { value: 'receita', label: 'Receita' },
          ]}
          tones={{ despesa: colors.expense, receita: colors.income }}
        />
      ) : null}

      <Row>
        <TextField
          label="Descrição"
          value={form.description}
          onChangeText={(v) => set('description', v)}
          error={errors.description}
          placeholder={form.kind === 'receita' ? 'Ex.: Salário' : 'Ex.: Mercado do mês'}
          style={{ flexGrow: 2 }}
        />
        <MoneyField
          label={form.seriesType === 'parcelado' && !isEdit ? (form.amountMode === 'total' ? 'Valor total' : 'Valor da parcela') : 'Valor'}
          value={form.amount}
          onChange={(v) => set('amount', v)}
          error={errors.amount}
        />
      </Row>

      <Row>
        <Select
          label="Categoria"
          value={form.categoryId}
          options={categoryOptions(data.categories, form.kind)}
          onChange={(v) => setForm((f) => ({ ...f, categoryId: v, subcategoryId: null }))}
          error={errors.categoryId}
        />
        <Select
          label="Subcategoria"
          value={form.subcategoryId}
          options={subcategoryOptions(data.categories, form.categoryId)}
          onChange={(v) => set('subcategoryId', v)}
          placeholder={form.categoryId ? 'Opcional' : 'Escolha a categoria'}
          allowClear
        />
      </Row>

      <View style={{ gap: 8 }}>
        <T variant="small" weight="medium" color={colors.ink2}>Forma de {form.kind === 'receita' ? 'recebimento' : 'pagamento'}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {methods.map((m) => (
            <Chip key={m} label={PAYMENT_LABEL[m]} selected={form.paymentMethod === m} onPress={() => changeMethod(m)} />
          ))}
        </View>
      </View>

      {isCard ? (
        <View style={styles.cardBox}>
          <Row>
            <Select
              label="Cartão"
              value={form.cardId}
              options={cardOptions(data.cards, form.cardId)}
              onChange={(v) => setForm((f) => ({ ...f, cardId: v, invoiceTouched: false }))}
              error={errors.cardId}
            />
            <DateField label="Data da compra" value={form.launchDate} onChange={(v) => set('launchDate', v)} />
          </Row>
          {card ? (
            <Select
              label="Lançar na fatura"
              value={form.invoiceRef}
              options={invoiceOptions(card, form.launchDate, form.invoiceRef)}
              onChange={(v) => setForm((f) => ({ ...f, invoiceRef: v, invoiceTouched: true }))}
              hint="Compras no dia do fechamento ou depois entram na fatura seguinte."
            />
          ) : null}
        </View>
      ) : (
        <Row>
          <Select
            label={form.kind === 'receita' ? 'Conta de destino' : 'Conta de saída'}
            value={form.accountId}
            options={accountOptions(data.accounts, form.accountId)}
            onChange={(v) => set('accountId', v)}
            error={errors.accountId}
          />
          <DateField
            label="Data de lançamento"
            value={form.launchDate}
            onChange={(v) => setForm((f) => ({ ...f, launchDate: v, dueDate: f.dueTouched ? f.dueDate : v }))}
          />
          <DateField
            label={form.seriesType === 'unico' || isEdit ? 'Vencimento' : '1º vencimento'}
            value={form.dueDate}
            onChange={(v) => setForm((f) => ({ ...f, dueDate: v, dueTouched: true }))}
            error={errors.dueDate}
          />
        </Row>
      )}

      {!isEdit ? (
        <>
          <Divider />
          <View style={{ gap: 12 }}>
            <T variant="small" weight="medium" color={colors.ink2}>Repetição</T>
            <Segmented
              value={form.seriesType}
              onChange={(v) => set('seriesType', v)}
              options={[
                { value: 'unico', label: 'Única' },
                { value: 'parcelado', label: 'Parcelada' },
                ...(isCard ? [] : [{ value: 'recorrente' as const, label: 'Recorrente' }]),
              ]}
            />

            {form.seriesType === 'parcelado' ? (
              <Row>
                <TextField
                  label="Parcelas"
                  value={form.installments}
                  onChangeText={(v) => set('installments', v.replace(/\D/g, ''))}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  error={errors.installments}
                />
                <View style={{ flexGrow: 2, flexBasis: 0, minWidth: 220, gap: 6 }}>
                  <T variant="small" weight="medium" color={colors.ink2}>O valor informado é</T>
                  <Segmented
                    value={form.amountMode}
                    onChange={(v) => set('amountMode', v)}
                    options={[
                      { value: 'total', label: 'Total da compra' },
                      { value: 'parcela', label: 'De cada parcela' },
                    ]}
                  />
                </View>
              </Row>
            ) : null}

            {form.seriesType === 'recorrente' ? (
              <>
                <Row>
                  <Select
                    label="Frequência"
                    value={form.frequency}
                    options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
                    onChange={(v) => v && set('frequency', v)}
                  />
                  <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 200, gap: 6 }}>
                    <T variant="small" weight="medium" color={colors.ink2}>Termina</T>
                    <Segmented
                      value={form.endMode}
                      onChange={(v) => set('endMode', v)}
                      options={[
                        { value: 'count', label: 'Após N vezes' },
                        { value: 'date', label: 'Em uma data' },
                      ]}
                    />
                  </View>
                </Row>
                {form.endMode === 'count' ? (
                  <TextField
                    label="Quantidade de lançamentos"
                    value={form.occurrences}
                    onChangeText={(v) => set('occurrences', v.replace(/\D/g, ''))}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    error={errors.occurrences}
                  />
                ) : (
                  <DateField
                    label="Último vencimento até"
                    value={form.untilDate}
                    onChange={(v) => set('untilDate', v)}
                    error={errors.occurrences}
                    hint={`${occurrences} lançamento(s) serão gerados.`}
                  />
                )}
              </>
            ) : null}

            {preview.length > 0 ? (
              <View style={styles.preview}>
                <View style={styles.previewHead}>
                  <T variant="label" color={colors.ink3}>
                    {preview.length} {form.seriesType === 'parcelado' ? 'parcelas' : 'lançamentos'}
                  </T>
                  <T variant="small" weight="semibold" tabular>Total {fmtMoney(previewTotal)}</T>
                </View>
                {!isCard ? (
                  <T variant="caption" color={colors.ink3}>Ajuste o vencimento ou o valor de cada parcela, se precisar.</T>
                ) : null}
                {preview.slice(0, 60).map((p, i) => (
                  <View key={p.index} style={styles.previewRow}>
                    <T variant="small" color={colors.ink3} tabular style={{ width: 52 }}>
                      {p.index}/{p.total}
                    </T>
                    {isCard ? (
                      <>
                        <T variant="small" style={{ flex: 1 }}>
                          Fatura {fmtRef(p.invoiceRef!)} · vence {fmtDate(p.dueDate)}
                        </T>
                        <T variant="small" weight="medium" tabular>{fmtMoney(p.amount)}</T>
                      </>
                    ) : (
                      <View style={{ flex: 1 }}>
                      <Row gap={8}>
                        <DateField
                          value={overrides[i]?.dueDate ?? p.dueDate}
                          onChange={(v) =>
                            setOverrides((o) => {
                              const next = [...o];
                              next[i] = { ...next[i], dueDate: v };
                              return next;
                            })
                          }
                        />
                        <MoneyField
                          value={overrides[i]?.amount ?? p.amount}
                          onChange={(v) =>
                            setOverrides((o) => {
                              const next = [...o];
                              next[i] = { ...next[i], amount: v ?? undefined };
                              return next;
                            })
                          }
                        />
                      </Row>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {!isEdit && !isCard ? (
        <Toggle
          value={form.settled}
          onChange={(v) => set('settled', v)}
          label={form.kind === 'receita' ? 'Já foi recebido' : 'Já foi pago'}
          hint={form.seriesType === 'unico' ? undefined : 'Marca somente o primeiro lançamento.'}
        />
      ) : null}

      <TextField label="Observações" value={form.notes} onChangeText={(v) => set('notes', v)} multiline placeholder="Opcional" />

      {isCard && !isEdit ? (
        <View style={[styles.note, { borderLeftColor: kindColor }]}>
          <T variant="caption" color={colors.ink2}>
            Compras no cartão são quitadas pelo pagamento da fatura, na tela de Cartões.
          </T>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cardBox: {
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
  },
  preview: {
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
  },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 4 },
});
