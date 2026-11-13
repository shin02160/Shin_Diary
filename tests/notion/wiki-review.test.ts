import assert from 'node:assert/strict';
import test from 'node:test';
import { entryEndDay, monthLessonCount, monthRecords, reviewMonth } from '../../src/lib/wiki-review.ts';
import type { Entry } from '../../src/lib/types.ts';
import type { ArchiveCalendarEvent } from '../../src/lib/calendar/archive.ts';

const entry: Entry = { id: 'a', category: 'Daily', title: '일기', content: '', tags: [],
 occurredAt: { kind: 'date', date: '2026-10-31' }, createdAt: '' };

test('review month comes from the explicit title and excludes samples and invalid months', () => {
 const review = { ...entry, title: '2026년 9월 통합 회고' };
 assert.equal(reviewMonth(review), '2026-09');
 assert.equal(reviewMonth({ ...review, title: '2026년 13월 통합 회고' }), undefined);
 assert.equal(reviewMonth({ ...review, isSample: true }), undefined);
 assert.deepEqual(monthRecords([review, entry, { ...entry }], '2026-10'), [entry]);
});

test('verified lesson count excludes duplicates, cancellations, future and unverified days', () => {
 const lesson = { title: '필라테스', wallStart: '2026-10-07T09:00', status: 'confirmed' } as ArchiveCalendarEvent;
 assert.equal(monthLessonCount([
  lesson, { ...lesson, wallStart: '2026-10-07T10:00' },
  { ...lesson, wallStart: '2026-10-12', status: 'cancelled' },
  { ...lesson, wallStart: '2026-10-15' },
  { ...lesson, wallStart: '2026-10-08' },
 ], '2026-10', '2026-10-13'), 1);
});

test('a record spanning months appears in each month it touches without inventing a period', () => {
 const trip = { ...entry, id: 'trip', category: 'Travel' as const, title: '2026 도쿄 여행 | 10.31~11.02' };
 assert.equal(entryEndDay(trip), '2026-11-02');
 assert.equal(entryEndDay({ ...entry, occurredEnd: '2026-11-03' }), '2026-11-03');
 assert.equal(entryEndDay({ ...trip, title: '연말 여행 12.30~01.02', occurredAt: { kind: 'date', date: '2026-12-30' } }), '2027-01-02');
 // The period must start on the recorded day and be a real, short range.
 for (const title of ['도쿄 여행 | 10.30~11.02', '버전 1.2~1.3', '10.31~10.31', '10.31~13.40', undefined]) {
  assert.equal(entryEndDay({ ...trip, title }), undefined);
 }
 assert.deepEqual(monthRecords([trip, entry], '2026-10').map(item => item.id), ['trip', 'a']);
 assert.deepEqual(monthRecords([trip, entry], '2026-11').map(item => item.id), ['trip']);
 assert.deepEqual(monthRecords([trip, entry], '2026-12'), []);
});
