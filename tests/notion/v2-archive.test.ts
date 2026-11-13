import assert from 'node:assert/strict';
import test from 'node:test';
import { deduplicateActivities } from '../../src/lib/activity-view.ts';
import { tasteClues, tasteEvidence } from '../../src/lib/interest-history.ts';
import { buildCatalog, calendarCatalogItem } from '../../src/lib/universe-catalog.ts';
import type { ArchiveCalendarEvent } from '../../src/lib/calendar/archive.ts';

const schedule: ArchiveCalendarEvent = {
 id: 'cal-a', pageId: 'page-a', importKey: 'occurrence-a', title: '필라테스',
 wallStart: '2026-10-07T18:00:00', wallEnd: '2026-10-07T19:00:00',
 allDay: false, sourceName: '외부 일정', description: '', status: 'confirmed',
};

test('shared calendar projection preserves time, verifies participation separately, and deduplicates by occurrence', () => {
 const now = Date.parse('2026-11-13T00:00:00Z');
 const first = calendarCatalogItem(schedule, now);
 assert.deepEqual(first.startAt, { kind: 'floating', local: schedule.wallStart });
 assert.equal(first.experienceVerified, true);
 assert.equal(calendarCatalogItem({ ...schedule, status: 'cancelled' }, now).experienceVerified, false);
 const duplicate = calendarCatalogItem({ ...schedule, id: 'cal-b', pageId: 'page-b' }, now);
 const repeat = calendarCatalogItem({ ...schedule, id: 'cal-c', importKey: 'occurrence-b' }, now);
 assert.deepEqual(deduplicateActivities([first, duplicate, repeat]).map(item => item.key), ['cal-a', 'cal-c']);
});

test('taste evidence spans years, honours browser decisions and excludes schedules, plans and generated reviews', () => {
 const entries = buildCatalog({ activities: [], entries: [
  { id: 'past', title: '엔플라잉 공연', category: 'Concert', date: '2023-10-31' },
  { id: 'current', title: '&Con5 도쿄 여행', category: 'Travel', date: '2026-10-31' },
  { id: 'manual', title: '합정 나들이', category: 'Daily', date: '2026-11-02' },
  { id: 'gpt-monthly-review-2026-10', title: '엔플라잉 GPT 회고', category: 'Daily', date: '2026-10-01' },
  { id: 'unrelated', title: '세븐틴', category: 'Concert', date: '2026-10-31' },
  { id: 'future', title: '엔플라잉', category: 'Concert', date: '2026-12-01' },
 ].map(({ id, title, category, date }) => ({
  id, title, category: category as 'Travel' | 'Concert' | 'Daily', content: '', tags: [],
  occurredAt: { kind: 'date', date: date as `${number}-${number}-${number}` }, createdAt: date,
 })) });
 const calendar = calendarCatalogItem({ ...schedule, title: '엔플라잉' }, Date.parse('2026-11-13'));
 const interest = { id: 'n', name: 'N.Flying', tags: [], relatedPageIds: [], moreRelations: false };
 const rows = tasteEvidence(interest, [...entries, calendar], '2026-11-13', ['entry:manual']);
 assert.deepEqual(rows.map(row => [row.item.sourcePageId, row.evidence, row.confirmed]),
  [['past', '제목', false], ['current', '제목', false], ['manual', '직접 승인', true]]);
 const clues = tasteClues(rows);
 assert.deepEqual([clues.firstDay, clues.years, clues.gaps, clues.kinds], ['2023-10-31', ['2023', '2026'], [['2024', '2025']], ['concert', 'travel', 'daily']]);
 assert.deepEqual(clues.labels.get('entry:past'), ['기록에서 처음 확인됨']);
 assert.deepEqual(clues.labels.get('entry:current'), ['2023년 이후 관련 기록이 없다가 다시 나타남', '여행 기록으로 처음 나타남']);
 assert.deepEqual(tasteEvidence(interest, entries, '2026-11-13', [], ['entry:current']).map(row => row.item.sourcePageId), ['past']);
});

test('a written record confirms the experience while an elapsed schedule alone does not', async () => {
 const { experienceConfirmed } = await import('../../src/lib/activity-timeline.ts');
 const { undatedCatalogItem } = await import('../../src/lib/universe-catalog.ts');
 const today = '2026-11-13', now = Date.parse('2026-11-13T00:00:00Z');
 const records = buildCatalog({ activities: [], entries: [['review', '2026-10-31'], ['future', '2026-12-01']].map(([id, date]) => ({
  id, title: id, category: 'Concert' as const, content: '', tags: [],
  occurredAt: { kind: 'date' as const, date: date as `${number}-${number}-${number}` }, createdAt: date,
 })) });
 const review = records.find(item => item.sourcePageId === 'review')!;
 const future = records.find(item => item.sourcePageId === 'future')!;
 const concert = calendarCatalogItem({ ...schedule, id: 'cal-concert', title: '공연', wallStart: '2026-10-31T18:00:00', wallEnd: '2026-10-31T21:00:00' }, now);
 assert.equal(experienceConfirmed(review, today), true);
 assert.equal(experienceConfirmed(future, today), false);
 assert.equal(concert.scheduleState, 'completed');
 assert.equal(experienceConfirmed(concert, today), false);
 assert.equal(experienceConfirmed(concert, today, new Set(['cal-concert'])), true);
 assert.equal(experienceConfirmed(calendarCatalogItem(schedule, now), today), true);
 const undated = undatedCatalogItem({ pageId: 'a'.repeat(32), title: '', category: 'Daily', updatedAt: '2026-11-01T00:00:00Z', tags: [] });
 assert.equal(undated.startAt, undefined);
 assert.equal(experienceConfirmed(undated, today), false);
 assert.equal(undated.title, '제목 없는 기록');
});
