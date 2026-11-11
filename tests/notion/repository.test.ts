import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Journal } from '../../src/lib/server/journal.ts';
import { NotionRepository } from '../../src/lib/server/notion-repository.ts';
import { AppError } from '../../src/lib/server/config.ts';
import { contentOf } from '../../src/lib/archive-schema.ts';
import { travelChoices } from '../../src/lib/server/travel-references.ts';
import { config, FakeNotion, activity, entry } from './fixtures.ts';
function fixture(t: {after:(fn:()=>void)=>void}) { const journal=new Journal(':memory:');t.after(()=>journal.close());const api=new FakeNotion();return {journal,api,repo:new NotionRepository(config,api,journal)}; }
test('activity and linked/independent entries round-trip without losing long content, explicit titles or archive state',async t=>{
 const {api,repo}=fixture(t);const a=activity();a.lifecycleStatus='satisfied';a.isArchived=true;a.nextStep='남은 일';a.references=['https://example.com'];
 const saved=await repo.save('activity',a);assert.equal(contentOf(saved.record),contentOf(a));
 const e=entry(a.id);e.content='가'.repeat(12000);e.title=e.content.slice(0,48);await repo.save('entry',e);await repo.save('entry',entry());
 const result=await repo.read();assert.equal(result.entries.length,2);assert.equal(result.entries[0].content,e.content);assert.equal(result.entries[0].title,e.title);assert.equal(result.entries[0].activityId,a.id);assert.equal(api.creates,3);
});
test('identical retry returns existing page, optimistic update works, stale base yields remote conflict',async t=>{
 const {api,repo}=fixture(t);const a=activity();const saved=await repo.save('activity',a);await repo.save('activity',a);assert.equal(api.creates,1);
 const changed={...saved.record,name:'새 이름'};const updated=await repo.save('activity',changed);assert.equal(api.patches,1);assert.equal('name' in updated.record && updated.record.name,'새 이름');
 await assert.rejects(repo.save('activity',{...saved.record,name:'오래된 탭'}),(e:unknown)=>e instanceof AppError && e.status===409 && !!e.conflict);
});
test('response lost after committed create recovers by App ID and does not create twice',async t=>{
 const {api,repo}=fixture(t);const a=activity();api.mode='committed-timeout';await assert.rejects(repo.save('activity',a));api.mode='normal';await repo.save('activity',a);assert.equal(api.creates,1);
});
test('uncertain unconfirmed create remains blocked across process restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'diary-notion-'));const path=join(directory,'state.sqlite');const api=new FakeNotion();const a=activity();let journal=new Journal(path);
 try {api.mode='lost-timeout';await assert.rejects(new NotionRepository(config,api,journal).save('activity',a));journal.close();journal=new Journal(path);api.mode='normal';await assert.rejects(new NotionRepository(config,api,journal).save('activity',a),(e:unknown)=>e instanceof AppError && e.status===409);assert.equal(api.creates,1);}finally{journal.close();rmSync(directory,{recursive:true,force:true});}
});
test('explicit rate-limit rejection permits safe retry',async t=>{
 const {api,repo}=fixture(t);const a=activity();api.mode='rate-limit';await assert.rejects(repo.save('activity',a));api.mode='normal';await repo.save('activity',a);assert.equal(api.pages.size,1);
});
test('duplicate App IDs and schema drift stop writes',async t=>{
 const {api,repo}=fixture(t);const a=activity();await repo.save('activity',a);const original=[...api.pages.values()][0];const duplicate={...original,id:'33333333-3333-4333-8333-333333333333'};api.pages.set(duplicate.id,duplicate);api.parents.set(duplicate.id,config.activitiesId);await assert.rejects(repo.save('activity',a));assert.equal(api.patches,0);api.schemaBroken=true;await assert.rejects(repo.read());
});
test('same-namespace concurrent saves are serialized by durable lease',async t=>{
 const {api,repo}=fixture(t);const a=activity();const result=await Promise.allSettled([repo.save('activity',a),repo.save('activity',a)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);await repo.save('activity',a);assert.equal(api.creates,1);
});
test('all-day, floating and zoned dates retain meaning and cleared fields round-trip',async t=>{
 const {repo}=fixture(t);const a=activity();const saved=await repo.save('activity',a);await repo.save('activity',{...saved.record,lastProgress:'',nextStep:'',references:[]});
 const floating=entry();floating.occurredAt={kind:'floating',local:'2026-11-11T10:30'};const zoned=entry();zoned.occurredAt={kind:'zoned',instant:'2026-11-11T10:30:00+09:00',timezone:'Asia/Seoul'};
 for(const e of [entry(),floating,zoned]){const saved=await repo.save('entry',e);assert.equal(contentOf(saved.record),contentOf(e));}
});
test('sample uploads, orphan relations, unsafe links and malformed metadata are rejected',async t=>{
 const {repo,api}=fixture(t);await assert.rejects(repo.save('activity',{...activity(),isSample:true}));await assert.rejects(repo.save('entry',entry('missing')));await assert.rejects(repo.save('activity',{...activity(),references:['javascript:alert(1)']}));await assert.rejects(repo.save('activity',{...activity(),notion:{pageId:'x',hash:'x'}}));assert.equal(api.creates,0);
});

test('paginated query consumes subsequent cursors without dropping records',async t=>{
 const {api,repo}=fixture(t);await repo.save('activity',activity());await repo.save('activity',activity());
 const pages=[...api.pages.values()];const original=api.call.bind(api);
 api.call=async function<T>(path:string,method='GET',body?:unknown):Promise<T>{
  if(path==='/data_sources/'+config.activitiesId+'/query'){
   const cursor=(body as {start_cursor?:string}).start_cursor;
   return {results:[pages[cursor?1:0]],has_more:!cursor,next_cursor:cursor?null:'page-two'} as T;
  }
  return original<T>(path,method,body);
 };
 assert.equal((await repo.read()).activities.length,2);
});
test('known remote page missing from source never gets silently recreated',async t=>{
 const {api,repo}=fixture(t);const result=await repo.save('activity',activity());api.pages.clear();api.parents.clear();
 await assert.rejects(repo.save('activity',result.record),(error:unknown)=>error instanceof AppError&&error.status===409);assert.equal(api.creates,1);
});

test('calendar snapshot requires the optional Entries property and survives Notion round-trip', async t => {
 const { api, repo } = fixture(t);
 const calendarEvent = {
  id: JSON.stringify(['개인', 'fixture', '']), title: '공연', date: '2026-11-11',
  period: '2026년 11월 11일 · 종일', sourceName: '개인', location: '서울 🎶',
 };
 const linked = { ...entry(), calendarEvent };
 await assert.rejects(repo.save('entry', linked), { status:422 });
 assert.equal(api.creates, 0);
 const call = api.call.bind(api);
 api.call = async function<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (path === '/data_sources/' + config.entriesId) {
   const response = await call<{ properties: Record<string, {type:string}> }>(path, method, body);
   response.properties['Calendar Event'] = { type:'rich_text' };
   return response as T;
  }
  return call<T>(path, method, body);
 };
 await repo.save('entry', linked);
 assert.deepEqual((await repo.read()).entries[0].calendarEvent, calendarEvent);
});

test('link-only entries round-trip and unsafe or unconfigured links stop before writing', async t => {
 const { api, repo } = fixture(t);
 const linked = { ...entry(), content: '', sourceLinks: ['https://example.org/trip?q=1#map'] };
 await assert.rejects(repo.save('entry', linked), { status:422 });
 await assert.rejects(repo.save('entry', { ...linked, sourceLinks:['javascript:alert(1)'] }), { status:400 });
 await assert.rejects(repo.save('entry', { ...linked, sourceLinks:['https://user:password@example.org/'] }), { status:400 });
 assert.equal(api.creates, 0);
 const call = api.call.bind(api);
 api.call = async function<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (path === '/data_sources/' + config.entriesId) {
   const response = await call<{ properties: Record<string, {type:string}> }>(path, method, body);
   response.properties['Source Links'] = { type:'rich_text' };
   return response as T;
  }
  return call<T>(path, method, body);
 };
 await repo.save('entry', linked);
 const [saved] = (await repo.read()).entries;
 assert.equal(saved.content, '');
 assert.deepEqual(saved.sourceLinks, linked.sourceLinks);
 await repo.save('entry', { ...saved, content: 'Updated entry', sourceLinks: undefined });
 assert.equal(api.patches, 1);
 assert.equal((await repo.read()).entries[0].sourceLinks, undefined);
});

test('photo-only records round-trip through Notion and optional fields can be cleared', async t => {
 const { api, repo } = fixture(t);
 const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(12000);
 const extras = { ...entry(), content: '', photo, travelReferences: { booking: 'https://example.org/booking' } };
 await assert.rejects(repo.save('entry', extras), { status: 422 });
 await assert.rejects(repo.save('entry', { ...extras, photo: 'data:image/svg+xml;base64,AAAA' }), { status: 400 });
 const call = api.call.bind(api);
 api.call = async function<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (path === '/data_sources/' + config.entriesId) {
   const response = await call<{ properties: Record<string, { type: string }> }>(path, method, body);
   response.properties['Diary Photo'] = { type: 'rich_text' };
   response.properties['Travel References'] = { type: 'rich_text' };
   return response as T;
  }
  return call<T>(path, method, body);
 };
 const saved = await repo.save('entry', extras);
 assert.equal(contentOf((await repo.read()).entries[0]), contentOf(extras));
 await repo.save('entry', { ...saved.record, content: '사진 제거 후 남긴 기록', photo: undefined, travelReferences: undefined });
 const updated = (await repo.read()).entries[0];
 assert.equal(updated.photo, undefined);
 assert.equal(updated.travelReferences, undefined);
 assert.equal(api.creates, 1);
 assert.equal(api.patches, 1);
});

test('Travel Hub picker exposes only matching trip relations and safe original page links', async () => {
 const id = (digit: string) => digit.repeat(32);
 const selected = id('1');
 const other = id('2');
 const page = (pageId: string, property: string, name: string, relation?: string[]) => ({
  id: pageId, object: 'page', properties: {
   [property]: { title: [{ plain_text: name }] },
   ...(relation ? { 여행: { relation: relation.map(id => ({ id })) } } : {}),
  },
 });
 const calls: { path: string; body: unknown }[] = [];
 const api = { async call<T>(path: string, method?: string, body?: unknown): Promise<T> {
  assert.equal(method, 'POST');
  calls.push({ path, body });
  return { results: path.endsWith(id('3') + '/query') ? [page(selected, '여행명', '테스트 여행')] :
   path.endsWith(id('4') + '/query') ? [
    page(id('7'), '예약명', '해당 여행', [selected]),
    page(id('8'), '예약명', '다른 여행', [other]),
    page(id('9'), '예약명', '복수 여행', [selected, other]),
   ] : [], has_more: false, next_cursor: null } as T;
 } };
 const sources = { trips: id('3'), booking: id('4'), expense: id('5'), receipt: id('6') };
 await assert.rejects(travelChoices(api, sources, other), { status: 404 });
 assert.deepEqual(await travelChoices(api, sources, selected), {
  resources: { booking: [{ name: '해당 여행', url: 'https://www.notion.so/' + id('7') }], expense: [], receipt: [] },
 });
 assert.ok(calls.slice(-3).every(call => (call.body as { filter: { relation: { contains: string } } }).filter.relation.contains === selected));
});
