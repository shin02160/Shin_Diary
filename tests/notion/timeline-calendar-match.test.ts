import assert from 'node:assert/strict';
import test from 'node:test';
import { timelineCalendarMatches, timelineYearCounts } from '../../src/lib/activity-timeline.ts';
import type { CatalogItem } from '../../src/lib/universe-catalog.ts';
import type { Entry } from '../../src/lib/types.ts';

test('annual counts group only explicit same-year calendar occurrences and keep source counts', () => {
 const date = { kind: 'date', date: '2026-10-31' } as const;
 const calendar: CatalogItem = { key: 'ics-1', sourceType: 'calendar', sourcePageId: 'calendar',
  title: '공연', type: '일정', category: 'concert', kind: 'concert', startAt: date,
  interestIds: [], tags: [], status: 'confirmed' };
 const entry: Entry = { id: 'a', category: 'Concert', content: '', createdAt: '', tags: [], occurredAt: date,
  calendarEvent: { id: 'ics-1', date: date.date, title: '공연', period: date.date, sourceName: 'Notion' } };
 const linked: CatalogItem = { ...calendar, key: 'entry:a', sourceType: 'entry', sourcePageId: 'a', type: '기록', entry };
 const unlinked = { ...linked, key: 'entry:b', entry: { ...entry, calendarEvent: undefined } };
 const prior = { ...linked, key: 'entry:c', startAt: { kind: 'date', date: '2025-10-31' } as const };
 const items = [calendar, linked, unlinked, prior];
 assert.equal(timelineCalendarMatches(items).size, 2);
 const years = timelineYearCounts(items, '2026-11-13');
 assert.deepEqual(years.get('2026')?.get('concert'), { records: 3, completed: 0, linkedCopies: 1 });
 assert.equal(years.get('2025')?.get('concert')?.linkedCopies, 0);
 assert.equal(timelineCalendarMatches([{ ...calendar, startAt: prior.startAt }, linked]).size, 0);
});
