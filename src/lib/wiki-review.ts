import { dateKey } from './dates.ts';
import { confirmedLesson } from './calendar/classification.ts';
import type { ArchiveCalendarEvent } from './calendar/archive.ts';
import type { Entry } from './types.ts';

export function reviewMonth(entry: Entry) {
 if (entry.category !== 'Daily' || entry.isSample) return;
 const match = /(?:^|\s)((?:19|20)\d{2})년\s*(1[0-2]|0?[1-9])월\s*통합\s*회고/.exec(entry.title ?? '');
 if (match) return match[1] + '-' + match[2].padStart(2, '0');
}

export const gptReviewId = (month: string) => 'gpt-monthly-review-' + month;

export function monthRecords(entries: Entry[], month: string) {
 const seen = new Set<string>();
 return entries.filter(entry => {
  if (entry.isSample || entry.id === gptReviewId(month) || reviewMonth(entry) || !dateKey(entry.occurredAt).startsWith(month + '-')) return false;
  const id = entry.notion?.pageId?.replaceAll('-', '').toLowerCase() || entry.id;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
 });
}

export function monthLessonCount(events: ArchiveCalendarEvent[], month: string, today: string) {
 return new Set(events.filter(event => event.wallStart.startsWith(month + '-') && confirmedLesson(event, today))
  .map(event => event.wallStart.slice(0, 10))).size;
}

export function recordsAddedAfter(records: { createdAt: string }[], updatedAt?: string) {
 const updated = Date.parse(updatedAt ?? '');
 if (!Number.isFinite(updated)) return 0;
 return records.filter(record => Date.parse(record.createdAt) > updated).length;
}
