import type { ExperienceDate } from './types';
export function dateKey(value: ExperienceDate): string {
  if (value.kind === 'date') return value.date;
  if (value.kind === 'floating') return value.local.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: value.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value.instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function dayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
export function dateLabel(value: ExperienceDate): string {
  const date = dayLabel(dateKey(value));
  if (value.kind === 'date') return date;
  if (value.kind === 'floating') return `${date} ${value.local.slice(11, 16)} (현지 시각)`;
  return `${date} ${new Intl.DateTimeFormat('ko-KR', { timeZone: value.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value.instant))} · ${value.timezone}`;
}
