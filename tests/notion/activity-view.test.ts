import test from 'node:test';
import assert from 'node:assert/strict';
import { activityStatus, parseActivityDate } from '../../src/lib/activity-view.ts';
import { dateKey } from '../../src/lib/dates.ts';
import { buildCatalog } from '../../src/lib/universe-catalog.ts';

test('activity dates preserve all-day, floating, and zoned values and reject invalid days', () => {
 assert.deepEqual(parseActivityDate('2028-02-29'), { kind: 'date', date: '2028-02-29' });
 assert.equal(parseActivityDate('2027-02-29'), undefined);
 assert.deepEqual(parseActivityDate('2026-11-12T09:30'), { kind: 'floating', local: '2026-11-12T09:30' });
 const zoned = parseActivityDate('2026-12-31T16:00:00Z', 'Asia/Seoul');
 assert.ok(zoned);
 assert.equal(dateKey(zoned), '2027-01-01');
 const offset = parseActivityDate('2027-01-01T00:30:00+09:00');
 assert.ok(offset);
 assert.equal(dateKey(offset), '2027-01-01');
});

test('normalized catalog deduplicates each source and never infers completion from dates', () => {
 const id = 'abcd1234abcd1234abcd1234abcd1234';
 const trip = { id, title: '여행', url: 'https://www.notion.so/' + id, start: '2020-01-01', sourceStatus: '준비중' };
 const result = buildCatalog({ entries: [], activities: [{
  id: 'project', name: '프로젝트', category: 'Projects', lifecycleStatus: 'satisfied',
  isArchived: false, summary: '', tags: [], updatedAt: '2026-01-01',
 }] }, {
  trips: { state: 'ready', truncated: false, items: [
   { ...trip, updatedAt: '2026-01-01' },
   { ...trip, id: 'ABCD1234-ABCD-1234-ABCD-1234ABCD1234', updatedAt: '2026-01-02', end: '2020-01-02' },
  ] },
  performances: { state: 'ready', truncated: false, items: [{ ...trip, title: '공연' }] },
 });
 assert.equal(result.length, 3);
 const actualTrip = result.find(row => row.sourceType === 'trips');
 assert.equal(actualTrip?.status, 'planned');
 assert.deepEqual(actualTrip?.endAt, { kind: 'date', date: '2020-01-02' });
 assert.equal(result.find(row => row.sourceType === 'performances')?.status, 'unknown');
 assert.equal(result.find(row => row.sourceType === 'activity')?.startAt, undefined);
 assert.equal(result.find(row => row.sourceType === 'activity')?.status, 'unknown');
 assert.equal(activityStatus('완료'), 'done');
 assert.equal(activityStatus('취소'), 'cancelled');
 assert.equal(activityStatus('여행중'), 'unknown');
});
