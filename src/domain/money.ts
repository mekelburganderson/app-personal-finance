import type { Cents } from './types';

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtMoney(cents: Cents): string {
  return formatter.format(cents / 100).replace(/ /g, ' ');
}

/** 1.234,56 (sem símbolo) */
export function fmtPlain(cents: Cents): string {
  return plain.format(cents / 100);
}

/** Formato compacto para eixos de gráfico: 1,2 mil / 3,4 mi */
export function fmtCompact(cents: Cents): string {
  const v = Math.abs(cents / 100);
  const sign = cents < 0 ? '-' : '';
  const short = (n: number) => n.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  if (v >= 1_000_000) return `${sign}${short(v / 1_000_000)} mi`;
  if (v >= 1_000) return `${sign}${short(v / 1_000)} mil`;
  return `${sign}${Math.round(v)}`;
}

/**
 * Converte o texto digitado em um campo de moeda para centavos.
 * Aceita "1.234,56", "1234,5", "1234.56" e "R$ 10".
 */
export function parseMoney(input: string): Cents | null {
  const s = input.replace(/[^\d,.-]/g, '');
  if (!s) return null;
  let normalized: string;
  if (s.includes(',')) normalized = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) normalized = s.replace(/\./g, '');
  else normalized = s;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Divide um total em N parcelas; a diferença de centavos fica na primeira. */
export function splitAmount(total: Cents, parts: number): Cents[] {
  const base = Math.floor(total / parts);
  const rest = total - base * parts;
  return Array.from({ length: parts }, (_, i) => (i === 0 ? base + rest : base));
}
