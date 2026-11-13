import assert from 'node:assert/strict';
import test from 'node:test';
import { tasteEras } from '../../src/lib/taste-eras.ts';
import { buildCatalog } from '../../src/lib/universe-catalog.ts';

const show = (id: string, start: string, detail: string, location = '서울 · 홀') =>
 ({ id, title: id, url: 'https://www.notion.so/' + id, start, detail, location });
const entry = (id: string, title: string, date: string, category: 'Concert' | 'Travel' | 'Daily', place?: string, tags: string[] = []) =>
 ({ id, title, category, content: '', tags, place, occurredAt: { kind: 'date' as const, date: date as `${number}-${number}-${number}` }, createdAt: date });

test('eras follow the subject that leads each year and describe only what the records hold', () => {
 const items = buildCatalog({ activities: [], entries: [
  entry('e1', 'DKZ 첫 팬콘서트', '2022-11-05', 'Concert'),
  entry('e2', '엔플라잉 공연 후기', '2025-06-01', 'Concert', undefined, ['밴드']),
  entry('e3', '도쿄 여행', '2025-06-01', 'Travel', '도쿄 · 이케부쿠로'),
  entry('e4', '2025년 6월 통합 회고 엔플라잉', '2025-06-30', 'Daily'),
  entry('e5', '민규네 집들이', '2025-07-01', 'Daily'),
  entry('e6', '엔플라잉 예정', '2027-01-01', 'Concert'),
 ] }, {
  trips: { state: 'ready', truncated: false, items: [{ id: 't1', title: '후쿠오카', url: 'https://www.notion.so/t1', start: '2024-12-20', location: '일본 · 후쿠오카', sourceStatus: '여행 완료' },
   { id: 't2', title: '상하이', url: 'https://www.notion.so/t2', start: '2025-02-01', location: '상하이', sourceStatus: '준비중' }] },
  performances: { state: 'ready', truncated: false, items: [
   show('p1', '2023-01-14', 'DKZ, 종형'), show('p2', '2023-03-01', 'DKZ'), show('p3', '2023-05-13', 'Nflying'),
   show('p4', '2024-04-27', 'SEVENTEEN', '인천 · 아시아드'), show('p5', '2024-12-21', 'SEVENTEEN, 민규', '후쿠오카 · 돔'),
   show('p6', '2025-06-01', 'Nflying'), show('p7', '2025-08-01', 'Nflying'),
  ] },
 });
 const interests = [{ id: 'n', name: 'N.Flying', aliases: ['엔플라잉'], tags: [], relatedPageIds: [], moreRelations: false }];
 const eras = tasteEras(items, interests, '2026-11-13');
 assert.deepEqual(eras.map(era => [era.from, era.to, era.subjects.map(subject => subject.name + ':' + subject.days + (subject.firstSeen ? '*' : ''))]), [
  ['2022', '2023', ['DKZ:3*', '종형:1*', 'N.Flying:1*']],
  ['2024', '2024', ['SEVENTEEN:2*', '민규:1*']],
  // The review and the database row of one concert day count once; the monthly review, the plan and the future entry do not count.
  ['2025', '2025', ['N.Flying:2']],
 ]);
 assert.equal(eras[2].subjects[0].interestId, 'n');
 assert.deepEqual(eras[1].places, [['일본', 1], ['후쿠오카', 1]]);
 assert.deepEqual(eras[1].cities, [['인천', 1], ['후쿠오카', 1]]);
 assert.deepEqual([eras[2].places, eras[2].keywords], [[['도쿄', 1]], [['밴드', 1]]]);
});
