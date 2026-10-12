/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMonths, brToISO } from '../src/domain/dates.ts';
import {
  accountBalance,
  buildInvoices,
  buildSeries,
  computeDashboard,
  countOccurrencesUntil,
  invoiceDates,
  invoiceRefForDate,
} from '../src/domain/finance.ts';
import { parseMoney, splitAmount } from '../src/domain/money.ts';
import type { Account, CreditCard, Transaction } from '../src/domain/types.ts';

const card: CreditCard = {
  id: 'c1', userId: 'u1', name: 'Nubank', lastDigits: '1234', limit: 500000,
  closingDay: 3, dueDay: 10, color: '#000', defaultAccountId: 'a1', archived: false,
};
const cardCrossMonth: CreditCard = { ...card, id: 'c2', closingDay: 25, dueDay: 5 };

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2), userId: 'u1', kind: 'despesa', description: 'x',
    amount: 1000, categoryId: null, subcategoryId: null, launchDate: '2026-10-01', dueDate: '2026-10-01',
    paymentMethod: 'pix', accountId: 'a1', cardId: null, invoiceRef: null, status: 'aberto',
    paidAt: null, paidAmount: null, seriesId: null, seriesType: 'unico', seriesIndex: 1, seriesTotal: 1,
    frequency: null, notes: '', createdAt: '', ...partial,
  };
}

test('datas: soma de meses respeita fim de mês', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', 2, 31), '2026-03-31');
  assert.equal(brToISO('05/11/2026'), '2026-11-05');
  assert.equal(brToISO('31/02/2026'), null);
});

test('dinheiro: parse e divisão em parcelas', () => {
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('R$ 10'), 1000);
  assert.equal(parseMoney('99.9'), 9990);
  assert.deepEqual(splitAmount(1000, 3), [334, 333, 333]);
});

test('fatura: compra antes do fechamento cai na fatura do mês', () => {
  assert.equal(invoiceRefForDate(card, '2026-10-02'), '2026-10');
  assert.deepEqual(invoiceDates(card, '2026-10'), { closingDate: '2026-10-03', dueDate: '2026-10-10' });
});

test('fatura: compra no dia do fechamento ou depois vai para a próxima', () => {
  assert.equal(invoiceRefForDate(card, '2026-10-03'), '2026-11');
  assert.equal(invoiceRefForDate(card, '2026-10-20'), '2026-11');
});

test('fatura: vencimento no mês seguinte ao fechamento', () => {
  // fecha 25, vence 5: compra em 10/10 fecha 25/10 e vence 05/11
  assert.equal(invoiceRefForDate(cardCrossMonth, '2026-10-10'), '2026-11');
  assert.deepEqual(invoiceDates(cardCrossMonth, '2026-11'), { closingDate: '2026-10-25', dueDate: '2026-11-05' });
  assert.equal(invoiceRefForDate(cardCrossMonth, '2026-12-28'), '2027-02');
});

test('parcelado no cartão distribui nas faturas seguintes', () => {
  const items = buildSeries({
    seriesType: 'parcelado', amount: 100000, amountMode: 'total', installments: 3, frequency: 'mensal',
    occurrences: 1, launchDate: '2026-10-20', firstDueDate: '2026-10-20', card,
  });
  assert.deepEqual(items.map((i) => i.invoiceRef), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(items.map((i) => i.dueDate), ['2026-11-10', '2026-12-10', '2027-01-10']);
  assert.deepEqual(items.map((i) => i.amount), [33334, 33333, 33333]);
});

test('parcelado avulso usa valor por parcela e vencimentos mensais', () => {
  const items = buildSeries({
    seriesType: 'parcelado', amount: 5000, amountMode: 'parcela', installments: 2, frequency: 'mensal',
    occurrences: 1, launchDate: '2026-01-15', firstDueDate: '2026-01-31', card: null,
  });
  assert.deepEqual(items.map((i) => [i.amount, i.dueDate]), [[5000, '2026-01-31'], [5000, '2026-02-28']]);
});

test('recorrente gera N ocorrências pela frequência', () => {
  const items = buildSeries({
    seriesType: 'recorrente', amount: 12000, amountMode: 'total', installments: 1, frequency: 'trimestral',
    occurrences: 3, launchDate: '2026-10-01', firstDueDate: '2026-10-10', card: null,
  });
  assert.deepEqual(items.map((i) => i.dueDate), ['2026-10-10', '2027-01-10', '2027-04-10']);
  assert.equal(countOccurrencesUntil('2026-10-10', 'mensal', '2027-03-10'), 6);
});

test('saldo considera só lançamentos pagos fora do cartão e pagamentos de fatura', () => {
  const account: Account = { id: 'a1', userId: 'u1', name: 'C', type: 'corrente', initialBalance: 10000, color: '', archived: false };
  const list = [
    tx({ kind: 'receita', amount: 5000, status: 'pago', paidAt: '2026-10-01' }),
    tx({ amount: 2000, status: 'pago', paidAt: '2026-10-02', paidAmount: 2100 }),
    tx({ amount: 9999, status: 'aberto' }),
    tx({ amount: 3000, cardId: 'c1', invoiceRef: '2026-10', paymentMethod: 'cartao_credito' }),
  ];
  const pays = [{ id: 'p', userId: 'u1', cardId: 'c1', invoiceRef: '2026-10', paidAt: '2026-10-10', accountId: 'a1', amount: 3000 }];
  assert.equal(accountBalance(account, list, pays), 10000 + 5000 - 2100 - 3000);
});

test('status das faturas e indicadores de 7 dias', () => {
  const list = [
    tx({ amount: 3000, cardId: 'c1', invoiceRef: '2026-10', launchDate: '2026-09-20', dueDate: '2026-10-10', paymentMethod: 'cartao_credito' }),
    tx({ amount: 4000, cardId: 'c1', invoiceRef: '2026-11', launchDate: '2026-10-05', dueDate: '2026-11-10', paymentMethod: 'cartao_credito' }),
    tx({ kind: 'receita', amount: 7000, dueDate: '2026-10-15' }),
    tx({ amount: 1500, dueDate: '2026-10-08' }), // vencida
  ];
  const invoices = buildInvoices(card, list, [], '2026-10-12');
  const byRef = Object.fromEntries(invoices.map((i) => [i.ref, i.status]));
  assert.equal(byRef['2026-10'], 'fechada');
  assert.equal(byRef['2026-11'], 'aberta');

  const account: Account = { id: 'a1', userId: 'u1', name: 'C', type: 'corrente', initialBalance: 0, color: '', archived: false };
  const d = computeDashboard({
    accounts: [account], cards: [card], transactions: list, payments: [],
    period: { from: '2026-09-13', to: '2026-10-12' }, refDate: '2026-10-12',
  });
  assert.equal(d.next7.receivable, 7000);
  assert.equal(d.overdue.payable, 1500 + 3000); // despesa vencida + fatura de outubro vencida
  assert.equal(d.cardSpending, 7000);
});
