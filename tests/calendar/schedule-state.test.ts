import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveScheduleState } from '../../src/lib/calendar/schedule-state.ts';
import { archiveCalendarEvent } from '../../src/lib/server/life-calendar.ts';

test('Notion status is preserved while elapsed state follows time and cancellation', () => {
 const now = Date.parse('2026-11-13T03:00:00Z');
 for (const raw of ['완료', '예정', 'confirmed', 'tentative', 'unknown', '취소됨']) {
  const event = archiveCalendarEvent({ id: 'a'.repeat(32), properties: {
   Name: { title: [{ plain_text: 'fixture' }] },
   'Import Key': { rich_text: [{ plain_text: 'original' }] },
   'Wall Start': { rich_text: [{ plain_text: '2026-11-13T09:00' }] },
   'Wall End': { rich_text: [{ plain_text: '2026-11-13T10:00' }] },
   Status: { select: { name: raw } },
  } }, now);
  assert.equal(event?.rawStatus, raw);
  assert.equal(event?.importKey, 'original');
  assert.equal(event?.scheduleState, raw === '취소됨' ? 'cancelled' : 'completed');
 }
});

test('timed and all-day boundaries respect the zone and exclusive end', () => {
 const event = { wallStart: '2026-11-13T00:00', wallEnd: '2026-11-13T00:30', originalTimezone: 'Asia/Tokyo' };
 const boundary = Date.parse('2026-11-12T15:30:00Z');
 assert.equal(deriveScheduleState(event, boundary), 'upcoming');
 assert.equal(deriveScheduleState(event, boundary + 1), 'completed');
 assert.equal(deriveScheduleState({ ...event, originalTimezone: '+08:00' }, boundary + 1), 'upcoming');
 assert.equal(deriveScheduleState({ ...event, rawStatus: 'canceled' }, boundary - 1), 'cancelled');
 assert.equal(deriveScheduleState({ ...event, wallEnd: '2026-11-01T01:30', originalTimezone: 'America/New_York' }, boundary), 'unknown');
 const allDay = { wallStart: '2026-11-11', wallEnd: '2026-11-13', endExclusive: true };
 const midnight = Date.parse('2026-11-12T15:00:00Z');
 assert.equal(deriveScheduleState(allDay, midnight - 1), 'upcoming');
 assert.equal(deriveScheduleState(allDay, midnight), 'completed');
 assert.equal(deriveScheduleState({ ...allDay, endExclusive: false }, midnight), 'upcoming');
});
