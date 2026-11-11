import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, filterCatalog } from '../../src/lib/universe-catalog.ts';
import type { Entry } from '../../src/lib/types.ts';
import type { NotionCollections } from '../../src/lib/notion-collections.ts';

test('catalog keeps real sources distinct and filters by displayed metadata', () => {
 const record: Entry = {
  id: 'shared', title: '산책', content: '본문에만 있는 단어',
  occurredAt: { kind: 'date', date: '2026-11-12' }, createdAt: '2026-11-12T03:00:00Z',
  category: 'Daily', place: '서울', tags: ['아침'],
 };
 const collections: NotionCollections = {
  trips: { state: 'ready', truncated: false, items: [{ id: 'shared', title: '여행', start: '2027-02-05',
   location: '상하이', url: 'https://www.notion.so/trip' }] },
  itinerary: { state: 'failed', message: '조회 실패' },
  performances: { state: 'ready', truncated: false, items: [{ id: 'shared', title: '공연', start: '2026-11-06',
   updatedAt: '2026-11-13T03:00:00Z', detail: '아티스트', url: 'https://www.notion.so/concert' }] },
 };
 const catalog = buildCatalog({ activities: [], entries: [record, { ...record, id: 'sample', isSample: true }] }, collections);
 assert.deepEqual(catalog.map(item => item.key), ['trips:shared', 'performances:shared', 'entry:shared']);
 assert.ok(catalog.every(item => item.cover === undefined));
 assert.deepEqual(filterCatalog(catalog, 'travel', '상하이', '2027', '').map(item => item.title), ['여행']);
 assert.deepEqual(filterCatalog(catalog, 'all', '아티스트', '2026', '').map(item => item.title), ['공연']);
 assert.deepEqual(filterCatalog(catalog, 'daily', '서울', '', '아침').map(item => item.title), ['산책']);
 assert.deepEqual(filterCatalog(catalog, 'all', '본문에만', '', ''), []);
});
