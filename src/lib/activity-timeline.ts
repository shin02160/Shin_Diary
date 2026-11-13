import { dateKey } from './dates.ts';
import type { CatalogItem } from './universe-catalog.ts';
import type { ActivityStatus, ActivityView } from './activity-view.ts';

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

export function timelineCalendarMatches(items: CatalogItem[]) {
 const calendars = new Map<string, CatalogItem>();
 for (const item of items) if (item.sourceType === 'calendar') calendars.set(item.key, item);
 const matches = new Map<string, CatalogItem>();
 for (const item of items) {
  const link = item.entry?.calendarEvent;
  const calendar = link && calendars.get(link.id);
  if (calendar && timelineDay(calendar.startAt) === link.date) matches.set(item.key, calendar);
 }
 return matches;
}

export function timelineYearCounts(items: CatalogItem[], today: string, matches = timelineCalendarMatches(items)) {
 const years = new Map<string, Map<ActivityView['category'], { records: number; completed: number; linkedCopies: number }>>();
 for (const item of items) {
  const day = timelineDay(item.startAt);
  if (!day) continue;
  const year = day.slice(0, 4);
  const counts = years.get(year) ?? new Map();
  const total = counts.get(item.category) ?? { records: 0, completed: 0, linkedCopies: 0 };
  if (timelineDay(matches.get(item.key)?.startAt)?.slice(0, 4) === year) total.linkedCopies++;
  total.records++;
  if (item.status === 'done' && (timelineDay(item.endAt) ?? day) <= today && day <= today) total.completed++;
  counts.set(item.category, total);
  years.set(year, counts);
 }
 return years;
}

/** Display lifecycle derived from the end of the experience, without mutating Notion source status. */
export function statusByElapsedDate(item: Pick<ActivityView, 'startAt' | 'endAt' | 'status'>, currentDay: string): ActivityStatus {
 if (item.status === 'cancelled') return 'cancelled';
 const start = timelineDay(item.startAt);
 if (!start) return item.status;
 const end = timelineDay(item.endAt) ?? start;
 if (end < currentDay) return 'done';
 if (start > currentDay) return 'planned';
 return item.status;
}
