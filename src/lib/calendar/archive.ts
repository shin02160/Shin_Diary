import { deriveScheduleState, type ScheduleState } from './schedule-state.ts';
import type { ImportedEvent } from './types.ts';

export interface ArchiveCalendarEvent {
 id: string;
 pageId: string;
 importKey: string;
 title: string;
 wallStart: string;
 wallEnd: string;
 allDay: boolean;
 sourceName: string;
 originalTimezone?: string;
 location?: string;
 description: string;
 interestIds?: string[];
 activityIds?: string[];
 status: ImportedEvent['status'];
 sourceStatus?: ImportedEvent['status'];
 rawStatus?: string;
 scheduleState?: ScheduleState;
 endExclusive?: boolean;
 endInstant?: string;
}

export function archiveCalendarEndDay(event: ArchiveCalendarEvent) {
 const end = event.wallEnd.slice(0, 10);
 const start = event.wallStart.slice(0, 10);
 if (event.endExclusive !== false && end > start && (event.allDay || /^00:00(?::00)?$/.test(event.wallEnd.slice(11)))) {
  return new Date(Date.parse(end) - 86_400_000).toISOString().slice(0, 10);
 }
 return end;
}

export function archiveCalendarOverlaps(event: ArchiveCalendarEvent, from: string, to: string) {
 return (!to || event.wallStart.slice(0, 10) <= to) && (!from || archiveCalendarEndDay(event) >= from);
}

export function archiveCalendarHref(event: ArchiveCalendarEvent) {
 return '/calendar?date=' + event.wallStart.slice(0, 10) + '&event=' + event.pageId + '#event-' + event.pageId;
}

export function scheduleCounts(events: ArchiveCalendarEvent[], now: number) {
 const counts = { completed: 0, upcoming: 0, cancelled: 0, unknown: 0 };
 const seen = new Set<string>();
 for (const event of events) {
  if (seen.has(event.importKey)) continue;
  seen.add(event.importKey);
  counts[event.scheduleState ?? deriveScheduleState(event, now)]++;
 }
 return counts;
}
