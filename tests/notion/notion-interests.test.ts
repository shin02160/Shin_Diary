import test from 'node:test';
import assert from 'node:assert/strict';
import { readInterests } from '../../src/lib/server/notion-interests.ts';

test('interest detail only reads related records from the configured interest source', async () => {
 const source = '1'.repeat(32), interest = '2'.repeat(32), relation = '3'.repeat(32);
 const calls: string[] = [];
 const api = { async call<T>(path: string): Promise<T> {
  calls.push(path);
  if (path.includes('/properties/')) return { results: [{ relation: { id: relation } }], has_more: false } as T;
  return { id: interest, object: 'page', parent: { type: 'data_source_id', data_source_id: source },
   properties: { Name: { title: [{ plain_text: '관심사' }] },
    RelatedActivities: { id: 'rel%3Aid', relation: [{ id: relation }], has_more: true } } } as T;
 } };
 assert.deepEqual(await readInterests(api), { configured: false, interests: [] });
 await assert.rejects(readInterests(api, '4'.repeat(32), interest), { status: 404 });
 assert.equal(calls.some(path => path.includes('/properties/')), false);
 const result = await readInterests(api, source, interest);
 assert.deepEqual(result.interests[0].relatedPageIds, [relation]);
 assert.equal(result.interests[0].moreRelations, false);
 assert.match(calls.at(-1) ?? '', /rel%3Aid/);
});

test('interest list reads the date range and reports a missing relation property instead of zero links', async () => {
 const source = '1'.repeat(32);
 const page = (id: string, properties: object) => ({ id: id.repeat(32), object: 'page', properties });
 const api = { async call<T>(): Promise<T> {
  return { has_more: false, results: [
   page('2', { '주제': { title: [{ plain_text: '가' }] }, '기간': { date: { start: '2023-10-05', end: '2026-10-31' } } }),
   page('3', { '주제': { title: [{ plain_text: '나' }] }, '관련 기록': { relation: [] }, '별칭': { rich_text: [{ plain_text: '엔플라잉, &Con5\n엔플라잉, x' }] } }),
  ] } as T;
 } };
 const [first, second] = (await readInterests(api, source)).interests;
 assert.deepEqual([first.startedAt, first.endedAt, first.relationsUnavailable], ['2023-10-05', '2026-10-31', true]);
 assert.deepEqual([second.startedAt, second.relationsUnavailable], [undefined, false]);
 assert.deepEqual([first.aliases, second.aliases], [[], ['엔플라잉', '&Con5']]);
});
