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
}

export function archiveCalendarEndDay(event: ArchiveCalendarEvent) {
 const end = event.wallEnd.slice(0, 10);
 const start = event.wallStart.slice(0, 10);
 if (end > start && (event.allDay || /^00:00(?::00)?$/.test(event.wallEnd.slice(11)))) {
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
