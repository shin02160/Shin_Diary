import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveCalendarEvent, readLifeCalendar } from '../../src/lib/server/life-calendar.ts';
import { archiveCalendarOverlaps } from '../../src/lib/calendar/archive.ts';

test('legacy rows preserve the import key and do not mark unstated status as complete', () => {
 const text = (plain_text: string) => ({ rich_text: [{ plain_text }] });
 const row = archiveCalendarEvent({ id: '1'.repeat(32), properties: {
  Name: { title: [{ plain_text: '기존 일정' }] },
  'Import Key': text('legacy-key'),
  'Wall Start': text('2026-10-31T23:00'),
  'Wall End': text('2026-11-01T00:00'),
 } });
 assert.ok(row);
 assert.equal(row.importKey, 'legacy-key');
 assert.equal(row.status, 'unknown');
 assert.equal(archiveCalendarOverlaps(row, '2026-11-01', '2026-11-01'), false);
 assert.equal(archiveCalendarOverlaps(row, '2026-10-31', '2026-10-31'), true);
 const allDay = { ...row, allDay: true, wallStart: '2026-10-30', wallEnd: '2026-11-01' };
 assert.equal(archiveCalendarOverlaps(allDay, '2026-10-31', '2026-10-31'), true);
 assert.equal(archiveCalendarOverlaps(allDay, '2026-11-01', '2026-11-01'), false);
});
test('interest lookup returns only explicitly related calendar records', async () => {
 const source = '1'.repeat(32), interest = '2'.repeat(32), activity = '3'.repeat(32);
 const text = (plain_text: string) => ({ rich_text: [{ plain_text }] });
 const row = (digit: string, related: boolean) => ({
  object: 'page', id: digit.repeat(32), properties: {
   Name: { title: [{ plain_text: '일정' }] }, 'Import Key': text(digit),
   'Wall Start': text('2026-11-12T15:00'), 'Wall End': text('2026-11-12T16:00'),
   ...(related ? { '관련 관심사': { relation: [{ id: interest }] }, '관련 활동': { relation: [{ id: activity }] } } : {}),
  },
 });
 const api = { async call<T>(): Promise<T> {
  return { results: [row('4', true), row('5', false)], has_more: false } as T;
 } };
 const result = await readLifeCalendar(api, source, '', '', interest);
 assert.deepEqual(result.events.map(event => event.pageId), ['4'.repeat(32)]);
 assert.deepEqual(result.events[0].activityIds, [activity]);
 assert.equal((await readLifeCalendar(api, source, '', '', '6'.repeat(32))).events.length, 0);
});
