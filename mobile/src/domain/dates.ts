import type { DateFormatId } from './types';

export function formatSealDate(iso: string, formatId: DateFormatId): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if (formatId === 'ko') {
    return `${y}년 ${m}월 ${day}일`;
  }
  // dot: YYYY.MM.DD
  const mm = String(m).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${y}.${mm}.${dd}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
