/**
 * Modelo de domínio do Personal Finance.
 *
 * Convenções:
 * - Valores monetários em centavos (inteiro) para evitar erro de ponto flutuante.
 * - Datas no formato ISO local `YYYY-MM-DD` (sem fuso).
 * - Toda entidade pertence a um usuário (`userId`); o repositório filtra por ele
 *   e, no Supabase, o mesmo isolamento será garantido por RLS.
 */

export type ISODate = string;
export type Cents = number;

export type EntryKind = 'receita' | 'despesa';

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'boleto'
  | 'debito'
  | 'transferencia'
  | 'debito_automatico'
  | 'cartao_credito';

export type Frequency =
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual';

/** Como o lançamento foi gerado. */
export type SeriesType = 'unico' | 'parcelado' | 'recorrente';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export type AccountType = 'corrente' | 'poupanca' | 'carteira' | 'investimento';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: Cents;
  color: string;
  archived: boolean;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  kind: EntryKind;
  /** `null` = categoria; preenchido = subcategoria. */
  parentId: string | null;
  color: string;
}

export interface CreditCard {
  id: string;
  userId: string;
  name: string;
  /** Últimos 4 dígitos, apenas para identificação visual. */
  lastDigits: string;
  limit: Cents;
  /** Dia do mês em que a fatura fecha (1–28). */
  closingDay: number;
  /** Dia do mês do vencimento da fatura (1–28). */
  dueDay: number;
  color: string;
  defaultAccountId: string | null;
  archived: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  kind: EntryKind;
  description: string;
  amount: Cents;
  categoryId: string | null;
  subcategoryId: string | null;
  /** Data de lançamento (competência / data da compra). */
  launchDate: ISODate;
  /** Data de vencimento. Em compras no cartão = vencimento da fatura. */
  dueDate: ISODate;
  paymentMethod: PaymentMethod;
  /** Conta prevista/usada no pagamento ou recebimento. */
  accountId: string | null;
  /** Preenchido quando a forma de pagamento é cartão de crédito. */
  cardId: string | null;
  /** Fatura de referência `YYYY-MM` (mês do vencimento da fatura). */
  invoiceRef: string | null;
  /** Para lançamentos fora do cartão. Itens de cartão seguem a fatura. */
  status: 'aberto' | 'pago';
  paidAt: ISODate | null;
  /** Valor efetivamente pago/recebido (pode diferir por juros/desconto). */
  paidAmount: Cents | null;
  seriesId: string | null;
  seriesType: SeriesType;
  /** Número da parcela/ocorrência (1-based) e total. */
  seriesIndex: number;
  seriesTotal: number;
  frequency: Frequency | null;
  notes: string;
  createdAt: string;
}

export interface InvoicePayment {
  id: string;
  userId: string;
  cardId: string;
  invoiceRef: string;
  paidAt: ISODate;
  accountId: string;
  amount: Cents;
}

export type InvoiceStatus = 'aberta' | 'fechada' | 'paga' | 'futura';

/** Fatura derivada: não é persistida, é calculada a partir dos lançamentos. */
export interface Invoice {
  cardId: string;
  ref: string;
  closingDate: ISODate;
  dueDate: ISODate;
  total: Cents;
  paid: Cents;
  status: InvoiceStatus;
  items: Transaction[];
  payments: InvoicePayment[];
}
