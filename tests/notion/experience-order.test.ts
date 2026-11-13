import assert from 'node:assert/strict';
import test from 'node:test';
import { compareExperience, experienceKey } from '../../src/lib/experience-order.ts';
import { buildCatalog, filterCatalog } from '../../src/lib/universe-catalog.ts';
import type { Entry } from '../../src/lib/types.ts';

test('catalog uses experience dates for order and year, even after later edits', () => {
 const entry = (id: string, date: `${number}-${number}-${number}`): Entry => ({
  id, title: id, category: 'Daily', tags: [], content: '',
  occurredAt: { kind: 'date', date }, createdAt: '2026-11-13', updatedAt: '2026-11-13',
 });
 const items = buildCatalog({ activities: [], entries: [
  entry('oct', '2023-10-05'), entry('dec', '2023-12-21'), entry('new', '2026-10-31'),
 ] });
 assert.deepEqual(items.map(item => item.title), ['new', 'dec', 'oct']);
 assert.deepEqual(filterCatalog(items, 'all', '', '2023', '').map(item => item.title), ['dec', 'oct']);
});

test('experience ordering uses the local date and time and puts undated records last', () => {
 const timed = { kind: 'zoned', instant: '2026-10-30T16:00:00Z', timezone: '+09:00' } as const;
 assert.equal(experienceKey(timed), '2026-10-31T01:00:00');
 const dated = { startAt: timed, sourceType: 'entry', sourcePageId: 'a' };
 const undated = { updatedAt: '2027-01-01', sourceType: 'activity', sourcePageId: 'b' };
 assert.deepEqual([undated, dated].sort(compareExperience), [dated, undated]);
});
