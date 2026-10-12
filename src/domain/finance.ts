import {
  addDays,
  addFrequency,
  addMonthsRef,
  dateInRef,
  inRange,
  monthRef,
} from './dates.ts';
import { splitAmount } from './money.ts';
import type {
  Account,
  Cents,
  CreditCard,
  Frequency,
  ISODate,
  Invoice,
  InvoicePayment,
  SeriesType,
  Transaction,
} from './types';

/* ------------------------------------------------------------------ */
/* Faturas de cartão                                                   */
/* ------------------------------------------------------------------ */

/**
 * Datas de uma fatura identificada pelo mês do vencimento (`ref`).
 * Se o vencimento é depois do fechamento no mês (ex.: fecha 3, vence 10),
 * ambos ocorrem no mesmo mês; caso contrário o fechamento é no mês anterior.
 */
export function invoiceDates(card: Pick<CreditCard, 'closingDay' | 'dueDay'>, ref: string) {
  const dueDate = dateInRef(ref, card.dueDay);
  const closingRef = card.dueDay > card.closingDay ? ref : addMonthsRef(ref, -1);
  const closingDate = dateInRef(closingRef, card.closingDay);
  return { closingDate, dueDate };
}

/**
 * Fatura em que cai uma compra feita em `date`. Compras no dia do fechamento
 * ou depois vão para a fatura seguinte (comportamento padrão dos emissores).
 */
export function invoiceRefForDate(card: Pick<CreditCard, 'closingDay' | 'dueDay'>, date: ISODate): string {
  const day = Number(date.slice(8, 10));
  let closingRef = monthRef(date);
  if (day >= card.closingDay) closingRef = addMonthsRef(closingRef, 1);
  return card.dueDay > card.closingDay ? closingRef : addMonthsRef(closingRef, 1);
}

export function invoiceStatus(
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  ref: string,
  total: Cents,
  paid: Cents,
  refDate: ISODate,
): Invoice['status'] {
  const { closingDate } = invoiceDates(card, ref);
  if (total > 0 && paid >= total) return 'paga';
  if (refDate >= closingDate) return total <= 0 ? 'paga' : 'fechada';
  const openRef = invoiceRefForDate(card, refDate);
  return ref === openRef ? 'aberta' : 'futura';
}

export function buildInvoices(
  card: CreditCard,
  transactions: Transaction[],
  payments: InvoicePayment[],
  refDate: ISODate,
): Invoice[] {
  const refs = new Set<string>([invoiceRefForDate(card, refDate)]);
  const items = transactions.filter((t) => t.cardId === card.id && t.invoiceRef);
  items.forEach((t) => refs.add(t.invoiceRef!));
  const cardPayments = payments.filter((p) => p.cardId === card.id);
  cardPayments.forEach((p) => refs.add(p.invoiceRef));

  return [...refs].sort().map((ref) => {
    const refItems = items
      .filter((t) => t.invoiceRef === ref)
      .sort((a, b) => a.launchDate.localeCompare(b.launchDate));
    const refPayments = cardPayments.filter((p) => p.invoiceRef === ref);
    // Receitas no cartão (estornos/créditos) abatem a fatura.
    const total = refItems.reduce((s, t) => s + (t.kind === 'despesa' ? t.amount : -t.amount), 0);
    const paid = refPayments.reduce((s, p) => s + p.amount, 0);
    const { closingDate, dueDate } = invoiceDates(card, ref);
    return {
      cardId: card.id,
      ref,
      closingDate,
      dueDate,
      total,
      paid,
      status: invoiceStatus(card, ref, total, paid, refDate),
      items: refItems,
      payments: refPayments,
    };
  });
}

/** Limite comprometido: soma das faturas não pagas (incluindo parcelas futuras). */
export function cardUsedLimit(invoices: Invoice[]): Cents {
  return invoices.reduce((s, inv) => s + Math.max(0, inv.total - inv.paid), 0);
}

/* ------------------------------------------------------------------ */
/* Geração de parcelas e recorrências                                  */
/* ------------------------------------------------------------------ */

export interface SeriesInput {
  seriesType: SeriesType;
  /** Valor digitado. Em parcelado, `amountMode` diz se é o total ou cada parcela. */
  amount: Cents;
  amountMode: 'total' | 'parcela';
  installments: number;
  frequency: Frequency;
  occurrences: number;
  launchDate: ISODate;
  firstDueDate: ISODate;
  card: Pick<CreditCard, 'closingDay' | 'dueDay'> | null;
  /** Fatura da 1ª parcela (cartão). Padrão: fatura em que cai a data de lançamento. */
  firstInvoiceRef?: string | null;
}

export interface SeriesItem {
  index: number;
  total: number;
  amount: Cents;
  launchDate: ISODate;
  dueDate: ISODate;
  invoiceRef: string | null;
}

export function buildSeries(input: SeriesInput): SeriesItem[] {
  const { card } = input;
  const firstRef = card ? input.firstInvoiceRef ?? invoiceRefForDate(card, input.launchDate) : null;
  const dueFor = (i: number, freq: Frequency = 'mensal') => {
    if (card && firstRef) {
      const ref = addMonthsRef(firstRef, i);
      return { dueDate: invoiceDates(card, ref).dueDate, invoiceRef: ref };
    }
    const preferred = Number(input.firstDueDate.slice(8, 10));
    return { dueDate: addFrequency(input.firstDueDate, freq, i, preferred), invoiceRef: null };
  };

  if (input.seriesType === 'parcelado') {
    const n = Math.max(1, Math.floor(input.installments));
    const amounts =
      input.amountMode === 'total' ? splitAmount(input.amount, n) : Array(n).fill(input.amount);
    return amounts.map((amount, i) => ({
      index: i + 1,
      total: n,
      amount,
      launchDate: input.launchDate,
      ...dueFor(i),
    }));
  }

  if (input.seriesType === 'recorrente') {
    const n = Math.max(1, Math.floor(input.occurrences));
    const preferredLaunch = Number(input.launchDate.slice(8, 10));
    return Array.from({ length: n }, (_, i) => ({
      index: i + 1,
      total: n,
      amount: input.amount,
      launchDate: addFrequency(input.launchDate, input.frequency, i, preferredLaunch),
      ...dueFor(i, input.frequency),
    }));
  }

  return [{ index: 1, total: 1, amount: input.amount, launchDate: input.launchDate, ...dueFor(0) }];
}

/** Quantas ocorrências cabem entre a 1ª data e a data final (inclusive). */
export function countOccurrencesUntil(first: ISODate, freq: Frequency, until: ISODate, max = 240): number {
  if (until < first) return 0;
  const preferred = Number(first.slice(8, 10));
  let n = 0;
  while (n < max && addFrequency(first, freq, n, preferred) <= until) n++;
  return n;
}

/* ------------------------------------------------------------------ */
/* Saldos e indicadores                                                */
/* ------------------------------------------------------------------ */

export const effectiveAmount = (t: Transaction) => t.paidAmount ?? t.amount;

/** Lançamento fora do cartão. Itens de cartão são liquidados via pagamento da fatura. */
export const isCash = (t: Transaction) => !t.cardId;

export function accountBalance(
  account: Account,
  transactions: Transaction[],
  payments: InvoicePayment[],
  upTo?: ISODate,
): Cents {
  let balance = account.initialBalance;
  for (const t of transactions) {
    if (!isCash(t) || t.status !== 'pago' || t.accountId !== account.id) continue;
    if (upTo && t.paidAt && t.paidAt > upTo) continue;
    balance += t.kind === 'receita' ? effectiveAmount(t) : -effectiveAmount(t);
  }
  for (const p of payments) {
    if (p.accountId !== account.id) continue;
    if (upTo && p.paidAt > upTo) continue;
    balance -= p.amount;
  }
  return balance;
}

export interface Period {
  from: ISODate;
  to: ISODate;
}

export interface UpcomingItem {
  id: string;
  kind: 'receita' | 'despesa' | 'fatura';
  description: string;
  dueDate: ISODate;
  amount: Cents;
  overdue: boolean;
  transaction?: Transaction;
  invoice?: Invoice;
  card?: CreditCard;
}

export interface DashboardData {
  balance: Cents;
  received: Cents;
  toReceiveInPeriod: Cents;
  paid: Cents;
  toPayInPeriod: Cents;
  result: Cents;
  cardSpending: Cents;
  openInvoicesTotal: Cents;
  nextInvoice: { invoice: Invoice; card: CreditCard } | null;
  next7: { receivable: Cents; payable: Cents; items: UpcomingItem[] };
  overdue: { receivable: Cents; payable: Cents; count: number };
  series: { date: ISODate; receitas: Cents; despesas: Cents }[];
}

/** Lista de pendências (despesas, receitas e faturas) até `until`. */
export function pendingItems(
  transactions: Transaction[],
  cards: CreditCard[],
  invoicesByCard: Map<string, Invoice[]>,
  refDate: ISODate,
  until: ISODate,
): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const t of transactions) {
    if (!isCash(t) || t.status !== 'aberto' || t.dueDate > until) continue;
    items.push({
      id: t.id,
      kind: t.kind,
      description: t.description,
      dueDate: t.dueDate,
      amount: t.amount,
      overdue: t.dueDate < refDate,
      transaction: t,
    });
  }
  for (const card of cards) {
    for (const inv of invoicesByCard.get(card.id) ?? []) {
      const open = inv.total - inv.paid;
      if (open <= 0 || inv.dueDate > until) continue;
      items.push({
        id: `${card.id}:${inv.ref}`,
        kind: 'fatura',
        description: `Fatura ${card.name}`,
        dueDate: inv.dueDate,
        amount: open,
        overdue: inv.dueDate < refDate,
        invoice: inv,
        card,
      });
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function computeDashboard(args: {
  accounts: Account[];
  cards: CreditCard[];
  transactions: Transaction[];
  payments: InvoicePayment[];
  period: Period;
  refDate: ISODate;
}): DashboardData {
  const { accounts, cards, transactions, payments, period, refDate } = args;
  const invoicesByCard = new Map(cards.map((c) => [c.id, buildInvoices(c, transactions, payments, refDate)]));

  const balance = accounts
    .filter((a) => !a.archived)
    .reduce((s, a) => s + accountBalance(a, transactions, payments), 0);

  let received = 0;
  let toReceiveInPeriod = 0;
  let paid = 0;
  let toPayInPeriod = 0;
  let cardSpending = 0;

  for (const t of transactions) {
    if (isCash(t)) {
      if (t.status === 'pago' && t.paidAt && inRange(t.paidAt, period.from, period.to)) {
        if (t.kind === 'receita') received += effectiveAmount(t);
        else paid += effectiveAmount(t);
      }
      if (t.status === 'aberto' && inRange(t.dueDate, period.from, period.to)) {
        if (t.kind === 'receita') toReceiveInPeriod += t.amount;
        else toPayInPeriod += t.amount;
      }
    } else if (t.kind === 'despesa' && inRange(t.launchDate, period.from, period.to)) {
      cardSpending += t.amount;
    }
  }
  for (const p of payments) {
    if (inRange(p.paidAt, period.from, period.to)) paid += p.amount;
  }

  let openInvoicesTotal = 0;
  let nextInvoice: DashboardData['nextInvoice'] = null;
  for (const card of cards) {
    for (const inv of invoicesByCard.get(card.id) ?? []) {
      const open = inv.total - inv.paid;
      if (open <= 0 || inv.status === 'futura') continue;
      openInvoicesTotal += open;
      if (!nextInvoice || inv.dueDate < nextInvoice.invoice.dueDate) nextInvoice = { invoice: inv, card };
    }
  }

  const horizon = addDays(refDate, 7);
  const pending = pendingItems(transactions, cards, invoicesByCard, refDate, horizon);
  const upcoming = pending.filter((i) => !i.overdue);
  const late = pending.filter((i) => i.overdue);
  const sum = (list: UpcomingItem[], receivable: boolean) =>
    list.filter((i) => (i.kind === 'receita') === receivable).reduce((s, i) => s + i.amount, 0);

  return {
    balance,
    received,
    toReceiveInPeriod,
    paid,
    toPayInPeriod,
    result: received - paid,
    cardSpending,
    openInvoicesTotal,
    nextInvoice,
    next7: { receivable: sum(upcoming, true), payable: sum(upcoming, false), items: upcoming },
    overdue: { receivable: sum(late, true), payable: sum(late, false), count: late.length },
    series: cashFlowSeries(transactions, payments, period),
  };
}

/** Fluxo realizado agrupado por dia (até 31 dias) ou por semana. */
export function cashFlowSeries(transactions: Transaction[], payments: InvoicePayment[], period: Period) {
  const days = Math.max(1, Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000) + 1);
  const step = days <= 31 ? 1 : 7;
  const buckets: { date: ISODate; receitas: Cents; despesas: Cents }[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, step)) {
    buckets.push({ date: d, receitas: 0, despesas: 0 });
  }
  const bucketOf = (iso: ISODate) => {
    const idx = Math.floor(Math.round((Date.parse(iso) - Date.parse(period.from)) / 86_400_000) / step);
    return buckets[Math.min(idx, buckets.length - 1)];
  };
  for (const t of transactions) {
    if (!isCash(t) || t.status !== 'pago' || !t.paidAt || !inRange(t.paidAt, period.from, period.to)) continue;
    const b = bucketOf(t.paidAt);
    if (t.kind === 'receita') b.receitas += effectiveAmount(t);
    else b.despesas += effectiveAmount(t);
  }
  for (const p of payments) {
    if (inRange(p.paidAt, period.from, period.to)) bucketOf(p.paidAt).despesas += p.amount;
  }
  return buckets;
}

/** Total por categoria (e subcategoria) pela data de lançamento. */
export function totalsByCategory(transactions: Transaction[], kind: Transaction['kind'], period: Period) {
  const map = new Map<string, { total: Cents; subs: Map<string, Cents> }>();
  for (const t of transactions) {
    if (t.kind !== kind || !inRange(t.launchDate, period.from, period.to)) continue;
    const key = t.categoryId ?? '__none__';
    const entry = map.get(key) ?? { total: 0, subs: new Map() };
    entry.total += t.amount;
    const subKey = t.subcategoryId ?? '__none__';
    entry.subs.set(subKey, (entry.subs.get(subKey) ?? 0) + t.amount);
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([categoryId, v]) => ({ categoryId, total: v.total, subs: [...v.subs.entries()].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.total - a.total);
}

/** Evolução mensal por vencimento: previsto x realizado. */
export function monthlyEvolution(transactions: Transaction[], refMonth: string, months: number) {
  const refs = Array.from({ length: months }, (_, i) => addMonthsRef(refMonth, i - months + 1));
  return refs.map((ref) => {
    let receitas = 0;
    let despesas = 0;
    for (const t of transactions) {
      if (monthRef(t.dueDate) !== ref) continue;
      if (t.kind === 'receita') receitas += t.amount;
      else despesas += t.amount;
    }
    return { ref, receitas, despesas, resultado: receitas - despesas };
  });
}

