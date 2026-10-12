import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { buildTransactions, type TransactionDraft } from '@/data/factory';
import { uid } from '@/data/ids';
import { repository } from '@/data/local-repository';
import type { Collection, Dataset } from '@/data/repository';
import { buildInvoices } from '@/domain/finance';
import { today } from '@/domain/dates';
import type { Account, Category, CreditCard, Invoice, InvoicePayment, Transaction } from '@/domain/types';
import { useAuth } from './auth';

/** Escopo de alteração/exclusão em lançamentos que fazem parte de uma série. */
export type SeriesScope = 'one' | 'following' | 'all';

export type TransactionPatch = Partial<
  Pick<
    Transaction,
    | 'description' | 'amount' | 'categoryId' | 'subcategoryId' | 'launchDate' | 'dueDate'
    | 'paymentMethod' | 'accountId' | 'cardId' | 'invoiceRef' | 'notes'
  >
>;

/** Campos que podem ser propagados para outras parcelas/ocorrências (datas não). */
const SERIES_FIELDS: (keyof TransactionPatch)[] = [
  'description', 'amount', 'categoryId', 'subcategoryId', 'paymentMethod', 'accountId', 'notes',
];

interface DataState extends Dataset {
  loading: boolean;
  invoicesByCard: Map<string, Invoice[]>;
  categoryById: Map<string, Category>;
  accountById: Map<string, Account>;
  cardById: Map<string, CreditCard>;

  saveAccount(a: Omit<Account, 'userId' | 'id'> & { id?: string }): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  saveCategory(c: Omit<Category, 'userId' | 'id'> & { id?: string }): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  saveCard(c: Omit<CreditCard, 'userId' | 'id'> & { id?: string }): Promise<void>;
  deleteCard(id: string): Promise<void>;

  createTransactions(draft: TransactionDraft, paidFirst?: { paidAt: string; accountId: string } | null): Promise<Transaction[]>;
  updateTransaction(id: string, patch: TransactionPatch, scope: SeriesScope): Promise<void>;
  deleteTransaction(id: string, scope: SeriesScope): Promise<void>;
  settle(id: string, info: { paidAt: string; accountId: string; paidAmount: number }): Promise<void>;
  reopen(id: string): Promise<void>;
  payInvoice(cardId: string, ref: string, info: { paidAt: string; accountId: string; amount: number }): Promise<void>;
  deleteInvoicePayment(id: string): Promise<void>;
  seriesOf(t: Transaction): Transaction[];
}

const DataContext = createContext<DataState | null>(null);

const empty: Dataset = { accounts: [], categories: [], cards: [], transactions: [], invoicePayments: [] };

export class InUseError extends Error {}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<Dataset>(empty);
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setData(empty);
      return;
    }
    setLoading(true);
    repository
      .load(userId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId]);

  const requireUser = useCallback(() => {
    if (!userId) throw new Error('Sem sessão');
    return userId;
  }, [userId]);

  /** Persiste e aplica no estado local (otimista após sucesso do repositório). */
  const upsert = useCallback(
    async <C extends Collection>(collection: C, items: Dataset[C]) => {
      const uidv = requireUser();
      await repository.upsert(uidv, collection, items);
      setData((prev) => {
        const list = [...(prev[collection] as { id: string }[])];
        for (const item of items as { id: string }[]) {
          const i = list.findIndex((x) => x.id === item.id);
          if (i >= 0) list[i] = item;
          else list.push(item);
        }
        return { ...prev, [collection]: list };
      });
    },
    [requireUser],
  );

  const remove = useCallback(
    async (collection: Collection, ids: string[]) => {
      const uidv = requireUser();
      await repository.remove(uidv, collection, ids);
      const set = new Set(ids);
      setData((prev) => ({ ...prev, [collection]: (prev[collection] as { id: string }[]).filter((x) => !set.has(x.id)) }));
    },
    [requireUser],
  );

  const derived = useMemo(() => {
    const refDate = today();
    return {
      invoicesByCard: new Map(data.cards.map((c) => [c.id, buildInvoices(c, data.transactions, data.invoicePayments, refDate)])),
      categoryById: new Map(data.categories.map((c) => [c.id, c])),
      accountById: new Map(data.accounts.map((a) => [a.id, a])),
      cardById: new Map(data.cards.map((c) => [c.id, c])),
    };
  }, [data]);

  const seriesOf = useCallback(
    (t: Transaction) =>
      t.seriesId
        ? data.transactions.filter((x) => x.seriesId === t.seriesId).sort((a, b) => a.seriesIndex - b.seriesIndex)
        : [t],
    [data.transactions],
  );

  const scoped = useCallback(
    (id: string, scope: SeriesScope) => {
      const t = data.transactions.find((x) => x.id === id);
      if (!t) return [];
      const series = seriesOf(t);
      if (scope === 'all') return series;
      if (scope === 'following') return series.filter((x) => x.seriesIndex >= t.seriesIndex);
      return [t];
    },
    [data.transactions, seriesOf],
  );

  const actions = useMemo(
    () => ({
      async saveAccount(a: Omit<Account, 'userId' | 'id'> & { id?: string }) {
        await upsert('accounts', [{ ...a, id: a.id ?? uid(), userId: requireUser() }]);
      },
      async deleteAccount(id: string) {
        const used =
          data.transactions.some((t) => t.accountId === id) || data.invoicePayments.some((p) => p.accountId === id);
        if (used) throw new InUseError('Esta conta possui lançamentos. Arquive-a em vez de excluir.');
        await remove('accounts', [id]);
      },
      async saveCategory(c: Omit<Category, 'userId' | 'id'> & { id?: string }) {
        await upsert('categories', [{ ...c, id: c.id ?? uid(), userId: requireUser() }]);
      },
      async deleteCategory(id: string) {
        const ids = [id, ...data.categories.filter((c) => c.parentId === id).map((c) => c.id)];
        const used = data.transactions.some((t) => ids.includes(t.categoryId ?? '') || ids.includes(t.subcategoryId ?? ''));
        if (used) throw new InUseError('Há lançamentos usando esta categoria. Reclassifique-os antes de excluir.');
        await remove('categories', ids);
      },
      async saveCard(c: Omit<CreditCard, 'userId' | 'id'> & { id?: string }) {
        await upsert('cards', [{ ...c, id: c.id ?? uid(), userId: requireUser() }]);
      },
      async deleteCard(id: string) {
        if (data.transactions.some((t) => t.cardId === id) || data.invoicePayments.some((p) => p.cardId === id)) {
          throw new InUseError('Este cartão possui faturas com lançamentos. Arquive-o em vez de excluir.');
        }
        await remove('cards', [id]);
      },

      async createTransactions(draft: TransactionDraft, paidFirst?: { paidAt: string; accountId: string } | null) {
        const card = draft.cardId ? data.cards.find((c) => c.id === draft.cardId) ?? null : null;
        const list = buildTransactions(requireUser(), draft, card);
        if (paidFirst && !list[0].cardId) {
          list[0] = { ...list[0], status: 'pago', paidAt: paidFirst.paidAt, accountId: paidFirst.accountId, paidAmount: list[0].amount };
        }
        await upsert('transactions', list);
        return list;
      },

      async updateTransaction(id: string, patch: TransactionPatch, scope: SeriesScope) {
        const targets = scoped(id, scope);
        const updated = targets.map((t) => {
          if (t.id === id) return { ...t, ...patch };
          const partial: TransactionPatch = {};
          for (const k of SERIES_FIELDS) if (k in patch) (partial as Record<string, unknown>)[k] = patch[k];
          return { ...t, ...partial };
        });
        await upsert('transactions', updated);
      },

      async deleteTransaction(id: string, scope: SeriesScope) {
        await remove('transactions', scoped(id, scope).map((t) => t.id));
      },

      async settle(id: string, info: { paidAt: string; accountId: string; paidAmount: number }) {
        const t = data.transactions.find((x) => x.id === id);
        if (!t) return;
        await upsert('transactions', [{ ...t, status: 'pago', paidAt: info.paidAt, accountId: info.accountId, paidAmount: info.paidAmount }]);
      },

      async reopen(id: string) {
        const t = data.transactions.find((x) => x.id === id);
        if (!t) return;
        await upsert('transactions', [{ ...t, status: 'aberto', paidAt: null, paidAmount: null }]);
      },

      async payInvoice(cardId: string, ref: string, info: { paidAt: string; accountId: string; amount: number }) {
        const payment: InvoicePayment = { id: uid(), userId: requireUser(), cardId, invoiceRef: ref, ...info };
        await upsert('invoicePayments', [payment]);
      },

      async deleteInvoicePayment(id: string) {
        await remove('invoicePayments', [id]);
      },
    }),
    [data, upsert, remove, requireUser, scoped],
  );

  const value = useMemo<DataState>(
    () => ({ ...data, loading, ...derived, ...actions, seriesOf }),
    [data, loading, derived, actions, seriesOf],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData fora do DataProvider');
  return ctx;
}

/** Status efetivo: itens de cartão herdam o status da fatura. */
export function useTransactionStatus() {
  const { invoicesByCard } = useData();
  return useCallback(
    (t: Transaction): 'pago' | 'aberto' | 'vencido' => {
      if (t.cardId && t.invoiceRef) {
        const inv = invoicesByCard.get(t.cardId)?.find((i) => i.ref === t.invoiceRef);
        if (inv?.status === 'paga') return 'pago';
        return inv && inv.dueDate < today() ? 'vencido' : 'aberto';
      }
      if (t.status === 'pago') return 'pago';
      return t.dueDate < today() ? 'vencido' : 'aberto';
    },
    [invoicesByCard],
  );
}
