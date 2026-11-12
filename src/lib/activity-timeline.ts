import { dateKey } from './dates.ts';
import type { ActivityView } from './activity-view.ts';

export function timelineDay(value: ActivityView['startAt']) {
 if (!value) return undefined;
 try {
  return dateKey(value);
 } catch {
  if (value.kind === 'zoned' && /^[+-]/.test(value.timezone)) return value.instant.slice(0, 10);
  return undefined;
 }
}

export function timelineRows<T extends ActivityView>(items: T[], from = '', to = '') {
 const rows = items.map(item => {
  const day = timelineDay(item.startAt);
  const end = timelineDay(item.endAt);
  return { item, day, end: day && end && end >= day ? end : day };
 });
 const dated = rows.flatMap(row => {
  if (!row.day || !row.end || (from && row.end < from) || (to && row.day > to)) return [];
  return [{ ...row, day: row.day, month: (from && row.day < from ? from : row.day).slice(0, 7) }];
 }).sort((a, b) => b.month.localeCompare(a.month) || b.day.localeCompare(a.day) || a.item.title.localeCompare(b.item.title, 'ko'));
 return { dated, undated: rows.filter(row => !row.day).map(row => row.item) };
}
