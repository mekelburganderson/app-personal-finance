import { addMonthsRef, fmtDate, fmtRef } from '@/domain/dates';
import { invoiceDates, invoiceRefForDate } from '@/domain/finance';
import { ACCOUNT_TYPE_LABEL } from '@/domain/labels';
import type { Account, Category, CreditCard, EntryKind } from '@/domain/types';
import type { SelectOption } from '@/ui/fields';

export function accountOptions(accounts: Account[], includeId?: string | null): SelectOption[] {
  return accounts
    .filter((a) => !a.archived || a.id === includeId)
    .map((a) => ({ value: a.id, label: a.name, hint: ACCOUNT_TYPE_LABEL[a.type], color: a.color }));
}

export function cardOptions(cards: CreditCard[], includeId?: string | null): SelectOption[] {
  return cards
    .filter((c) => !c.archived || c.id === includeId)
    .map((c) => ({ value: c.id, label: c.name, hint: `•••• ${c.lastDigits} · fecha dia ${c.closingDay}`, color: c.color }));
}

export function categoryOptions(categories: Category[], kind: EntryKind): SelectOption[] {
  return categories
    .filter((c) => c.kind === kind && !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name, color: c.color }));
}

export function subcategoryOptions(categories: Category[], parentId: string | null): SelectOption[] {
  if (!parentId) return [];
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }));
}

/** Faturas selecionáveis para uma compra: a anterior, a da data e as próximas. */
export function invoiceOptions(card: CreditCard, launchDate: string, extraRef?: string | null): SelectOption[] {
  const auto = invoiceRefForDate(card, launchDate);
  const refs = new Set(Array.from({ length: 8 }, (_, i) => addMonthsRef(auto, i - 1)));
  if (extraRef) refs.add(extraRef);
  return [...refs].sort().map((ref) => {
    const { closingDate, dueDate } = invoiceDates(card, ref);
    return {
      value: ref,
      label: `Fatura de ${fmtRef(ref)}${ref === auto ? ' (sugerida)' : ''}`,
      hint: `Fecha ${fmtDate(closingDate)} · vence ${fmtDate(dueDate)}`,
    };
  });
}
