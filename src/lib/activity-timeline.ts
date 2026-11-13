import { compareExperience, experienceKey } from './experience-order.ts';
import type { CatalogItem } from './universe-catalog.ts';
import type { ActivityView } from './activity-view.ts';

export function timelineDay(value: ActivityView['startAt']) {
 return experienceKey(value).slice(0, 10) || undefined;
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
 }).sort((a, b) => b.month.localeCompare(a.month) || compareExperience(a.item, b.item));
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

// A written record is evidence that the experience happened; an elapsed schedule alone is not.
export function experienceConfirmed(item: CatalogItem, today: string, reviewedCalendars: ReadonlySet<string> = new Set()) {
 const day = timelineDay(item.startAt);
 if (!day || (timelineDay(item.endAt) ?? day) > today || item.status === 'cancelled') return false;
 if (item.sourceType === 'entry') return true;
 if (item.sourceType === 'calendar') return item.status === 'done' && Boolean(item.experienceVerified || reviewedCalendars.has(item.key));
 return item.status === 'done';
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

export function timelineSourceLinks(item: CatalogItem, itemsByPage: Map<string, CatalogItem>) {
 const links = new Map<string, CatalogItem>();
 for (const source of item.entry?.sourceLinks ?? []) {
  const url = URL.parse(source);
  if (!url || url.protocol !== 'https:' || !['notion.so', 'www.notion.so'].includes(url.hostname)) continue;
  const pageId = /(?:^|[-/])([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i.exec(url.pathname)?.[1];
  const target = pageId && itemsByPage.get(pageId.replaceAll('-', '').toLowerCase());
  if (target && target.key !== item.key) links.set(target.key, target);
 }
 return [...links.values()];
}
