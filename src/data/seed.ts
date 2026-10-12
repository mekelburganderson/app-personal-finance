import { buildInvoices } from '@/domain/finance';
import { addDays, addMonths, dateInRef, monthRef, today } from '@/domain/dates';
import type { Account, Category, CreditCard, EntryKind, InvoicePayment, Transaction } from '@/domain/types';
import { buildTransactions, type TransactionDraft } from './factory';
import { uid } from './ids';
import type { Dataset } from './repository';

/** Usuário de demonstração do protótipo (dados apenas locais). */
export const DEMO_USER = {
  id: 'demo-user',
  name: 'Ana Ribeiro',
  email: 'demo@personalfinance.app',
  password: 'demo1234',
};

const CATEGORY_TREE: { kind: EntryKind; name: string; color: string; subs: string[] }[] = [
  { kind: 'receita', name: 'Salário', color: '#2F7D5B', subs: ['Mensal', '13º salário', 'Férias'] },
  { kind: 'receita', name: 'Trabalho extra', color: '#4F9A7A', subs: ['Freelance', 'Consultoria'] },
  { kind: 'receita', name: 'Investimentos', color: '#3C6E8F', subs: ['Dividendos', 'Rendimentos'] },
  { kind: 'receita', name: 'Outras receitas', color: '#7A8B83', subs: ['Reembolsos', 'Presentes'] },
  { kind: 'despesa', name: 'Moradia', color: '#B5523A', subs: ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet'] },
  { kind: 'despesa', name: 'Alimentação', color: '#C98B2B', subs: ['Mercado', 'Restaurantes', 'Delivery'] },
  { kind: 'despesa', name: 'Transporte', color: '#5B6C8F', subs: ['Combustível', 'App de transporte', 'Manutenção'] },
  { kind: 'despesa', name: 'Saúde', color: '#8E5B8C', subs: ['Plano de saúde', 'Farmácia', 'Consultas'] },
  { kind: 'despesa', name: 'Educação', color: '#3E7C86', subs: ['Cursos', 'Livros'] },
  { kind: 'despesa', name: 'Lazer', color: '#D07A5A', subs: ['Streaming', 'Passeios', 'Viagens'] },
  { kind: 'despesa', name: 'Compras', color: '#6E7B4F', subs: ['Roupas', 'Eletrônicos', 'Casa'] },
  { kind: 'despesa', name: 'Dívidas', color: '#7D4E3A', subs: ['Financiamento', 'Empréstimo'] },
  { kind: 'despesa', name: 'Outras despesas', color: '#8A8580', subs: ['Taxas', 'Presentes'] },
];

export function defaultCategories(userId: string): Category[] {
  const list: Category[] = [];
  for (const c of CATEGORY_TREE) {
    const parent: Category = { id: uid(), userId, name: c.name, kind: c.kind, parentId: null, color: c.color };
    list.push(parent);
    for (const s of c.subs) {
      list.push({ id: uid(), userId, name: s, kind: c.kind, parentId: parent.id, color: c.color });
    }
  }
  return list;
}

export function demoDataset(userId: string): Dataset {
  const T = today();
  const categories = defaultCategories(userId);
  const cat = (name: string, sub?: string) => {
    const parent = categories.find((c) => c.name === name && !c.parentId)!;
    const child = sub ? categories.find((c) => c.parentId === parent.id && c.name === sub) : undefined;
    return { categoryId: parent.id, subcategoryId: child?.id ?? null };
  };

  const accounts: Account[] = [
    { id: uid(), userId, name: 'Nubank', type: 'corrente', initialBalance: 420000, color: '#6B3FA0', archived: false },
    { id: uid(), userId, name: 'Itaú', type: 'corrente', initialBalance: 980000, color: '#E26A1B', archived: false },
    { id: uid(), userId, name: 'Carteira', type: 'carteira', initialBalance: 30000, color: '#2F7D5B', archived: false },
  ];
  const [nubank, itau, carteira] = accounts;

  const cards: CreditCard[] = [
    { id: uid(), userId, name: 'Nubank Ultravioleta', lastDigits: '4821', limit: 1500000, closingDay: 3, dueDay: 10, color: '#3D2A5C', defaultAccountId: nubank.id, archived: false },
    { id: uid(), userId, name: 'Itaú Click', lastDigits: '0937', limit: 700000, closingDay: 25, dueDay: 5, color: '#B4541A', defaultAccountId: itau.id, archived: false },
  ];
  const [nuCard, itauCard] = cards;

  const start = addMonths(T, -3);
  const thisMonth = monthRef(T);
  const base = (d: Partial<TransactionDraft> & Pick<TransactionDraft, 'kind' | 'description' | 'amount'>): TransactionDraft => ({
    amountMode: 'total',
    seriesType: 'unico',
    installments: 1,
    frequency: 'mensal',
    occurrences: 1,
    launchDate: T,
    firstDueDate: T,
    paymentMethod: 'pix',
    accountId: itau.id,
    cardId: null,
    firstInvoiceRef: null,
    categoryId: null,
    subcategoryId: null,
    notes: '',
    ...d,
  });
  const monthly = (day: number, monthsBack: number, total: number) => {
    const first = dateInRef(monthRef(addMonths(T, -monthsBack)), day);
    return { seriesType: 'recorrente' as const, launchDate: first, firstDueDate: first, occurrences: total };
  };

  const drafts: [TransactionDraft, CreditCard | null][] = [
    [base({ kind: 'receita', description: 'Salário', amount: 875000, ...monthly(5, 3, 12), ...cat('Salário', 'Mensal'), paymentMethod: 'transferencia' }), null],
    [base({ kind: 'receita', description: 'Projeto landing page — Studio Ápice', amount: 240000, launchDate: addDays(T, -6), firstDueDate: addDays(T, 4), ...cat('Trabalho extra', 'Freelance'), accountId: nubank.id }), null],
    [base({ kind: 'receita', description: 'Consultoria — 3 parcelas', amount: 360000, seriesType: 'parcelado', installments: 3, launchDate: addDays(T, -40), firstDueDate: addDays(T, -30), ...cat('Trabalho extra', 'Consultoria'), accountId: nubank.id }), null],
    [base({ kind: 'receita', description: 'Dividendos', amount: 18740, launchDate: addDays(T, -12), firstDueDate: addDays(T, -12), ...cat('Investimentos', 'Dividendos') }), null],
    [base({ kind: 'despesa', description: 'Aluguel', amount: 230000, ...monthly(10, 3, 12), ...cat('Moradia', 'Aluguel'), paymentMethod: 'boleto' }), null],
    [base({ kind: 'despesa', description: 'Condomínio', amount: 61500, ...monthly(8, 3, 12), ...cat('Moradia', 'Condomínio'), paymentMethod: 'boleto' }), null],
    [base({ kind: 'despesa', description: 'Conta de luz — Enel', amount: 18540, ...monthly(15, 3, 12), ...cat('Moradia', 'Energia'), paymentMethod: 'debito_automatico' }), null],
    [base({ kind: 'despesa', description: 'Conta de água — Sabesp', amount: 9230, ...monthly(Number(addDays(T, -3).slice(8)), 3, 12), ...cat('Moradia', 'Água'), paymentMethod: 'boleto' }), null],
    [base({ kind: 'despesa', description: 'Internet fibra', amount: 11990, ...monthly(12, 3, 12), ...cat('Moradia', 'Internet'), paymentMethod: 'debito_automatico', accountId: nubank.id }), null],
    [base({ kind: 'despesa', description: 'Plano de saúde', amount: 48900, ...monthly(Number(addDays(T, 3).slice(8)), 3, 12), ...cat('Saúde', 'Plano de saúde'), paymentMethod: 'boleto' }), null],
    [base({ kind: 'despesa', description: 'Financiamento do carro', amount: 128900, seriesType: 'parcelado', amountMode: 'parcela', installments: 48, launchDate: addMonths(T, -10), firstDueDate: dateInRef(monthRef(addMonths(T, -10)), 18), ...cat('Dívidas', 'Financiamento'), paymentMethod: 'boleto' }), null],
    [base({ kind: 'despesa', description: 'Empréstimo pessoal', amount: 64000, seriesType: 'parcelado', amountMode: 'parcela', installments: 12, launchDate: addMonths(T, -2), firstDueDate: dateInRef(monthRef(addMonths(T, -2)), 25), ...cat('Dívidas', 'Empréstimo'), paymentMethod: 'debito_automatico', accountId: nubank.id }), null],
    [base({ kind: 'despesa', description: 'Feira', amount: 8650, launchDate: addDays(T, -2), firstDueDate: addDays(T, -2), ...cat('Alimentação', 'Mercado'), paymentMethod: 'dinheiro', accountId: carteira.id }), null],
    [base({ kind: 'despesa', description: 'IPVA — 2ª cota', amount: 72300, launchDate: addDays(T, -20), firstDueDate: addDays(T, 6), ...cat('Transporte', 'Manutenção'), paymentMethod: 'boleto' }), null],
  ];

  const cardBuys: [string, number, number, string, string, CreditCard, number?][] = [
    ['Supermercado Pão de Açúcar', 41280, -4, 'Alimentação', 'Mercado', nuCard],
    ['Supermercado Pão de Açúcar', 38790, -34, 'Alimentação', 'Mercado', nuCard],
    ['Supermercado Pão de Açúcar', 45210, -63, 'Alimentação', 'Mercado', nuCard],
    ['iFood', 6890, -1, 'Alimentação', 'Delivery', nuCard],
    ['iFood', 5420, -9, 'Alimentação', 'Delivery', nuCard],
    ['Restaurante Mocotó', 21400, -15, 'Alimentação', 'Restaurantes', itauCard],
    ['Posto Shell', 25000, -7, 'Transporte', 'Combustível', itauCard],
    ['Posto Shell', 23000, -29, 'Transporte', 'Combustível', itauCard],
    ['Uber', 3460, -3, 'Transporte', 'App de transporte', nuCard],
    ['Netflix', 5590, -11, 'Lazer', 'Streaming', nuCard],
    ['Spotify', 2190, -18, 'Lazer', 'Streaming', nuCard],
    ['Drogasil', 8930, -22, 'Saúde', 'Farmácia', itauCard],
    ['Notebook Dell Inspiron', 499000, -50, 'Compras', 'Eletrônicos', nuCard, 10],
    ['Passagens aéreas — Recife', 186000, -26, 'Lazer', 'Viagens', itauCard, 6],
    ['Curso de inglês online', 89700, -45, 'Educação', 'Cursos', nuCard, 3],
    ['Renner', 32990, -13, 'Compras', 'Roupas', itauCard, 2],
  ];
  for (const [description, amount, offset, c, s, card, n] of cardBuys) {
    const d = addDays(T, offset);
    drafts.push([
      base({
        kind: 'despesa', description, amount, launchDate: d, firstDueDate: d, paymentMethod: 'cartao_credito',
        cardId: card.id, seriesType: n ? 'parcelado' : 'unico', installments: n ?? 1, ...cat(c, s),
      }),
      card,
    ]);
  }

  let transactions: Transaction[] = drafts.flatMap(([draft, card]) => buildTransactions(userId, draft, card));

  // Remove ocorrências anteriores ao início do histórico demo (exceto parcelamentos longos).
  transactions = transactions.filter((t) => t.seriesType === 'parcelado' || t.dueDate >= start);

  // Tudo que venceu até hoje está pago, exceto a conta de água deste mês (vencida em aberto).
  transactions = transactions.map((t) => {
    if (t.cardId || t.dueDate > T) return t;
    if (t.description.startsWith('Conta de água') && monthRef(t.dueDate) === thisMonth) return t;
    return { ...t, status: 'pago', paidAt: t.dueDate, paidAmount: t.amount };
  });

  // Paga as faturas já vencidas.
  const invoicePayments: InvoicePayment[] = [];
  for (const card of cards) {
    for (const inv of buildInvoices(card, transactions, [], T)) {
      if (inv.dueDate < T && inv.total > 0) {
        invoicePayments.push({
          id: uid(), userId, cardId: card.id, invoiceRef: inv.ref, paidAt: inv.dueDate,
          accountId: card.defaultAccountId!, amount: inv.total,
        });
      }
    }
  }

  return { accounts, categories, cards, transactions, invoicePayments };
}
