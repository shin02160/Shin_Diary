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
 const interest = { id: 'interest', name: 'N.Flying', aliases: ['엔플라잉', '&Con5'], tags: ['공연'], relatedPageIds: [], moreRelations: false };
 const links = interestLinks(interest, items, ['entry:concert']);
 assert.deepEqual(links.map(row => row.item.key).sort(), ['entry:concert', 'entry:review', 'entry:trip']);
 assert.equal(links.find(row => row.item.key === 'entry:concert')?.sources.length, 2);
 assert.equal(links.find(row => row.item.key === 'entry:concert')?.confirmed, true);
 assert.deepEqual(interestLinks({ ...interest, name: 'SEVENTEEN', aliases: [] }, items, []).map(row => row.item.key), ['entry:other']);
});

test('subject names come from the record and its Notion aliases, never from a built-in list', async () => {
 const { interestTerms, matchesTerms } = await import('../../src/lib/interest-links.ts');
 assert.deepEqual(interestTerms('N.Flying'), ['n.flying', 'nflying']);
 assert.deepEqual(interestTerms('N.Flying', ['엔플라잉', ' Nflying ']), ['n.flying', 'nflying', '엔플라잉']);
 assert.equal(matchesTerms(interestTerms('N.Flying'), '엔플라잉 공연'), false);
 assert.equal(matchesTerms(interestTerms('N.Flying', ['엔플라잉']), '엔플라잉 공연'), true);
 assert.equal(matchesTerms(interestTerms('N.Flying'), '2026 Nflying LIVE'), true);
 assert.equal(matchesTerms(interestTerms('SEVENTEEN'), '세븐틴 콘서트'), false);
});
