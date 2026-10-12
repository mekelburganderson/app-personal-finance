import type { Frequency, ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function today(): ISODate {
  return toISO(new Date());
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISO(parseISO(iso)) === iso;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Soma meses preservando o dia quando possível (31/01 + 1 mês = 28 ou 29/02). */
export function addMonths(iso: ISODate, months: number, preferredDay?: number): ISODate {
  const d = parseISO(iso);
  const day = preferredDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const clamped = Math.min(day, daysInMonth(target.getFullYear(), target.getMonth()));
  return toISO(new Date(target.getFullYear(), target.getMonth(), clamped));
}

export function addFrequency(iso: ISODate, freq: Frequency, steps: number, preferredDay?: number): ISODate {
  switch (freq) {
    case 'semanal':
      return addDays(iso, 7 * steps);
    case 'quinzenal':
      return addDays(iso, 14 * steps);
    case 'mensal':
      return addMonths(iso, steps, preferredDay);
    case 'bimestral':
      return addMonths(iso, 2 * steps, preferredDay);
    case 'trimestral':
      return addMonths(iso, 3 * steps, preferredDay);
    case 'semestral':
      return addMonths(iso, 6 * steps, preferredDay);
    case 'anual':
      return addMonths(iso, 12 * steps, preferredDay);
  }
}

export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function inRange(iso: ISODate, from: ISODate, to: ISODate) {
  return iso >= from && iso <= to;
}

/** `YYYY-MM` */
export function monthRef(iso: ISODate): string {
  return iso.slice(0, 7);
}

export function addMonthsRef(ref: string, months: number): string {
  return monthRef(addMonths(`${ref}-01`, months));
}

export function dateInRef(ref: string, day: number): ISODate {
  const [y, m] = ref.split('-').map(Number);
  const clamped = Math.min(day, daysInMonth(y, m - 1));
  return `${ref}-${pad(clamped)}`;
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${monthRef(iso)}-01`;
}

export function endOfMonth(iso: ISODate): ISODate {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** 12/10/2026 */
export function fmtDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** 12 out */
export function fmtShort(iso: ISODate): string {
  const d = parseISO(iso);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** out/26 */
export function fmtRef(ref: string): string {
  const [y, m] = ref.split('-').map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

/** outubro de 2026 */
export function fmtRefLong(ref: string): string {
  const [y, m] = ref.split('-').map(Number);
  return `${MONTHS_FULL[m - 1]} de ${y}`;
}

/** Converte `dd/mm/aaaa` para ISO; retorna null se inválida. */
export function brToISO(br: string): ISODate | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return isValidISO(iso) ? iso : null;
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};
