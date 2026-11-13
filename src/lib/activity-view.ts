import { dateKey } from './dates.ts';
import type { ExperienceDate, LocalDate } from './types.ts';

export type ActivitySource = 'trips' | 'performances' | 'entry' | 'activity' | 'calendar' | 'timeline';
export type ActivityStatus = 'planned' | 'confirmed' | 'done' | 'cancelled' | 'unknown';
export type ActivityCategory = 'travel' | 'concert' | 'daily' | 'project' | 'uncategorized';

export interface ActivityView {
 sourceType: ActivitySource;
 sourcePageId: string;
 occurrenceKey?: string;
 title: string;
 category: ActivityCategory;
 startAt?: ExperienceDate;
 endAt?: ExperienceDate;
 status: ActivityStatus;
 location?: string;
 summary?: string;
 cover?: string;
 interestIds: string[];
 originalUrl?: string;
 updatedAt?: string;
}

const pageIdPattern = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const normalizedPageId = (value: string) => pageIdPattern.test(value) ? value.replaceAll('-', '').toLowerCase() : value;

export function notionActivityUrl(id?: string) {
 return id && pageIdPattern.test(id) ? 'https://www.notion.so/' + normalizedPageId(id) : undefined;
}

export function parseActivityDate(value?: string, timezone?: string): ExperienceDate | undefined {
 if (!value) return;
 const match = /^(\d{4}-\d{2}-\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.exec(value);
 if (!match) return;
 const day = new Date(match[1] + 'T00:00:00Z');
 if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== match[1]) return;
 if (value.length === 10) return { kind: 'date', date: value as LocalDate };
 if (match[2] && !Number.isFinite(Date.parse(value))) return;
 if (match[2] && timezone) {
  const zoned: ExperienceDate = { kind: 'zoned', instant: value, timezone };
  try { dateKey(zoned); return zoned; } catch { /* Preserve the timestamp and its original offset below. */ }
 }
 if (match[2]) {
  const offset = match[2] === 'Z' ? 'UTC' : match[2];
  return { kind: 'zoned', instant: value, timezone: offset };
 }
 return { kind: 'floating', local: value };
}

export function activityStatus(value?: string): ActivityStatus {
 switch (value?.trim().toLowerCase()) {
  case '예정': case '여행 예정': case '준비중': case '계획': case 'planned': return 'planned';
  case '완료': case '여행 완료': case 'done': case 'completed': return 'done';
  case '취소': case '여행 취소': case 'cancelled': case 'canceled': return 'cancelled';
  default: return 'unknown';
 }
}

export function deduplicateActivities<T extends ActivityView>(items: T[]): T[] {
 const records = new Map<string, T>();
 for (const item of items) {
  const id = item.sourceType + ':' + (item.occurrenceKey || normalizedPageId(item.sourcePageId));
  const previous = records.get(id);
  const updated = Date.parse(item.updatedAt ?? '');
  const previousUpdated = Date.parse(previous?.updatedAt ?? '');
  if (!previous || (Number.isFinite(updated) && (!Number.isFinite(previousUpdated) || updated > previousUpdated))) {
   records.set(id, item);
  }
 }
 return Array.from(records.values());
}
