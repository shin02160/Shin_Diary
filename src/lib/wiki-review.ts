import { dateKey } from './dates.ts';
import { deriveScheduleState } from './calendar/schedule-state.ts';
import { confirmedLesson } from './calendar/classification.ts';
import type { ArchiveCalendarEvent } from './calendar/archive.ts';
import type { Entry } from './types.ts';

export function reviewMonth(entry: Entry) {
 if (entry.category !== 'Daily' || entry.isSample) return;
 const match = /(?:^|\s)((?:19|20)\d{2})년\s*(1[0-2]|0?[1-9])월\s*통합\s*회고/.exec(entry.title ?? '');
 if (match) return match[1] + '-' + match[2].padStart(2, '0');
}

// The last day of a record that spans several days: the Notion date range, or a period written in the
// title ("도쿄 여행 | 10.31~11.02") when it begins on the recorded day.
export function entryEndDay(entry: Pick<Entry, 'occurredAt' | 'occurredEnd' | 'title'>) {
 const start = dateKey(entry.occurredAt);
 if (entry.occurredEnd && entry.occurredEnd > start) return entry.occurredEnd;
 const match = /(?:^|\D)(\d{1,2})\.(\d{1,2})\s*[~∼–-]\s*(\d{1,2})\.(\d{1,2})(?!\d)/.exec(entry.title ?? '');
 if (!match) return;
 const [fromMonth, fromDay, toMonth, toDay] = match.slice(1).map(Number);
 if (fromMonth !== Number(start.slice(5, 7)) || fromDay !== Number(start.slice(8, 10))) return;
 const end = [Number(start.slice(0, 4)) + (toMonth < fromMonth ? 1 : 0), toMonth, toDay].map(part => String(part).padStart(2, '0')).join('-');
 const time = Date.parse(end + 'T00:00:00Z');
 if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== end) return;
 const days = (time - Date.parse(start + 'T00:00:00Z')) / 86_400_000;
 return days > 0 && days <= 60 ? end : undefined;
}

export const gptReviewId = (month: string) => 'gpt-monthly-review-' + month;

export function monthRecords(entries: Entry[], month: string) {
 const seen = new Set<string>();
 return entries.filter(entry => {
  if (entry.isSample || entry.id === gptReviewId(month) || reviewMonth(entry)) return false;
  // A record spanning months belongs to each month it touches.
  const start = dateKey(entry.occurredAt);
  if (start.slice(0, 7) > month || (entryEndDay(entry) ?? start).slice(0, 7) < month) return false;
  const id = entry.notion?.pageId?.replaceAll('-', '').toLowerCase() || entry.id;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
 });
}

export function monthLessonCount(events: ArchiveCalendarEvent[], month: string, today: string, now = Date.now()) {
 return new Set(events.filter(event => (event.scheduleState ?? deriveScheduleState(event, now)) === 'completed' && event.wallStart.startsWith(month + '-') && confirmedLesson(event, today))
  .map(event => event.wallStart.slice(0, 10))).size;
}

export function recordsAddedAfter(records: { createdAt: string }[], updatedAt?: string) {
 const updated = Date.parse(updatedAt ?? '');
 if (!Number.isFinite(updated)) return 0;
 return records.filter(record => Date.parse(record.createdAt) > updated).length;
}
