import assert from 'node:assert/strict';
import test from 'node:test';
import { interestLinks } from '../../src/lib/interest-links.ts';
import { buildCatalog, calendarCatalogItem } from '../../src/lib/universe-catalog.ts';
import type { Entry } from '../../src/lib/types.ts';

test('interest discovery keeps artist evidence separate and combines explicit calendar duplicates', () => {
 const base = { category: 'Concert', content: '', createdAt: '', tags: [],
  occurredAt: { kind: 'date', date: '2026-10-31' } } as const;
 const entries: Entry[] = [
  { ...base, tags: [], id: 'concert', title: '&Con5 Tokyo', calendarEvent: {
   id: 'event', title: 'N.Flying', date: '2026-10-31', period: '2026-10-31', sourceName: 'fixture',
  } },
  { ...base, tags: [], id: 'trip', category: 'Travel', title: '도쿄 여행', content: '엔플라잉 공연' },
  { ...base, tags: [], id: 'review', category: 'Daily', title: '2026년 10월 통합 회고', content: 'N.Flying' },
  { ...base, tags: [], id: 'other', title: 'SEVENTEEN' },
  { ...base, tags: [], id: 'noise', title: 'seventeenth day' },
 ];
 const calendar = calendarCatalogItem({ id: 'event', importKey: 'event', pageId: 'a'.repeat(32), title: 'N.Flying',
  wallStart: '2026-10-31', wallEnd: '2026-11-01', allDay: true, sourceName: 'fixture', description: '', status: 'confirmed',
 }, Date.parse('2026-11-13'));
 const items = [...buildCatalog({ activities: [], entries }), calendar];
 const interest = { id: 'interest', name: 'N.Flying', tags: ['공연'], relatedPageIds: [], moreRelations: false };
 const links = interestLinks(interest, items, ['entry:concert']);
 assert.deepEqual(links.map(row => row.item.key).sort(), ['entry:concert', 'entry:review', 'entry:trip']);
 assert.equal(links.find(row => row.item.key === 'entry:concert')?.sources.length, 2);
 assert.equal(links.find(row => row.item.key === 'entry:concert')?.confirmed, true);
 assert.deepEqual(interestLinks({ ...interest, name: 'SEVENTEEN' }, items, []).map(row => row.item.key), ['entry:other']);
});
