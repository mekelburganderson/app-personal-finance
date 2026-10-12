import { buildSeries } from '@/domain/finance';
import type {
  CreditCard,
  EntryKind,
  Frequency,
  ISODate,
  PaymentMethod,
  SeriesType,
  Transaction,
} from '@/domain/types';
import { nowISO, uid } from './ids';

/** Dados do formulário de lançamento antes de virar uma ou mais transações. */
export interface TransactionDraft {
  kind: EntryKind;
  description: string;
  amount: number;
  amountMode: 'total' | 'parcela';
  seriesType: SeriesType;
  installments: number;
  frequency: Frequency;
  occurrences: number;
  launchDate: ISODate;
  firstDueDate: ISODate;
  paymentMethod: PaymentMethod;
  accountId: string | null;
  cardId: string | null;
  firstInvoiceRef: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  notes: string;
  /** Ajustes manuais por parcela (vencimento/valor) vindos da pré-visualização. */
  overrides?: { dueDate?: ISODate; amount?: number }[];
}

export function buildTransactions(userId: string, draft: TransactionDraft, card: CreditCard | null): Transaction[] {
  const isCard = draft.paymentMethod === 'cartao_credito' && !!card;
  const items = buildSeries({
    seriesType: draft.seriesType,
    amount: draft.amount,
    amountMode: draft.amountMode,
    installments: draft.installments,
    frequency: draft.frequency,
    occurrences: draft.occurrences,
    launchDate: draft.launchDate,
    firstDueDate: draft.firstDueDate,
    card: isCard ? card : null,
    firstInvoiceRef: isCard ? draft.firstInvoiceRef : null,
  });
  const seriesId = items.length > 1 ? uid() : null;
  const createdAt = nowISO();

  return items.map((item, i) => {
    const o = draft.overrides?.[i];
    return {
      id: uid(),
      userId,
      kind: draft.kind,
      description: draft.description.trim(),
      amount: o?.amount ?? item.amount,
      categoryId: draft.categoryId,
      subcategoryId: draft.subcategoryId,
      launchDate: item.launchDate,
      dueDate: isCard ? item.dueDate : o?.dueDate ?? item.dueDate,
      paymentMethod: draft.paymentMethod,
      accountId: isCard ? card!.defaultAccountId : draft.accountId,
      cardId: isCard ? card!.id : null,
      invoiceRef: isCard ? item.invoiceRef : null,
      status: 'aberto',
      paidAt: null,
      paidAmount: null,
      seriesId,
      seriesType: draft.seriesType,
      seriesIndex: item.index,
      seriesTotal: item.total,
      frequency: draft.seriesType === 'recorrente' ? draft.frequency : null,
      notes: draft.notes.trim(),
      createdAt,
    };
  });
}
