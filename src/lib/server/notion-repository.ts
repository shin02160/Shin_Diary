import { photoProperty, travelProperty } from '../entry-extras.ts';
import { sourceLinksProperty } from '../source-links.ts';
import { calendarEntryProperty } from '../calendar/entry-link.ts';
import { createHash } from 'node:crypto';
import { decode, validateRecord, type ArchiveRecord, type RecordKind, type RemoteRecord } from '../archive-schema.ts';
import type { Activity, Entry } from '../types.ts';
import { AppError, type Config } from './config.ts';
import { Journal } from './journal.ts';
import { NotionError, type Transport } from './notion-client.ts';
import { fingerprint, fromPage, properties, readText, schemas, type NotionPage } from './notion-mapping.ts';
interface PageList { results: NotionPage[]; has_more: boolean; next_cursor?: string | null }
interface DataSource { properties: Record<string,{type:string; relation?:{data_source_id?:string}}> }
export class NotionRepository {
 private namespace: string;
 constructor(private config: Config, private api: Transport, private journal: Journal) { this.namespace = createHash('sha256').update(config.activitiesId+config.entriesId).digest('hex'); }
 private source(kind: RecordKind) { return kind === 'activity' ? this.config.activitiesId : this.config.entriesId; }
 async checkSchema(needsCalendarEvent = false, needsSourceLinks = false, extras?: Entry) {
  for (const kind of ['activity','entry'] as const) {
   const source = await this.api.call<DataSource>('/data_sources/'+this.source(kind));
   const missing = Object.entries(schemas[kind]).filter(([name,type]) => source.properties?.[name]?.type !== type).map(([name])=>name);
   if (missing.length) throw new AppError(422,`Notion ${kind === 'activity' ? 'Activities' : 'Entries'} 속성을 확인해 주세요: ${missing.join(', ')}`);
   if (kind === 'entry' && extras) {
    for (const [value, name] of [[extras.photo, photoProperty], [extras.travelReferences, travelProperty]] as const) {
     if (value && source.properties[name]?.type !== 'rich_text') throw new AppError(422, 'Entries에 ' + name + ' 텍스트 속성을 추가해 주세요.');
    }
   }
   if (kind === 'entry' && needsSourceLinks && source.properties[sourceLinksProperty]?.type !== 'rich_text') {
    throw new AppError(422, '관련 링크를 반영하려면 Entries에 Source Links 텍스트 속성을 추가해 주세요.');
   }
   if (kind === 'entry' && needsCalendarEvent && source.properties[calendarEntryProperty]?.type !== 'rich_text') {
    throw new AppError(422, '일정에 연결된 기록을 반영하려면 Entries에 Calendar Event 텍스트 속성을 추가해 주세요.');
   }
   if (kind === 'entry' && source.properties.Activity.relation?.data_source_id?.replaceAll('-','') !== this.config.activitiesId.replaceAll('-','')) throw new AppError(422,'Entries의 Activity 관계가 설정된 Activities 데이터 소스를 가리켜야 합니다.');
  }
 }
 private async query(kind: RecordKind, id?: string) {
  const pages: NotionPage[] = []; let cursor: string | undefined;
  for (let batch=0; batch<100; batch++) {
   const result = await this.api.call<PageList>('/data_sources/'+this.source(kind)+'/query','POST',{ page_size:100, filter:{property:'App ID',rich_text:id ? {equals:id} : {is_not_empty:true}}, ...(cursor ? {start_cursor:cursor} : {}) });
   if (!Array.isArray(result.results)) throw new AppError(502,'Notion 목록 응답을 확인할 수 없습니다.');
   pages.push(...result.results.filter(p=>p.object === 'page' && !p.archived && !p.in_trash));
   if (pages.length>5000) throw new AppError(413,'한 번에 읽을 수 있는 기록 수를 초과했습니다.');
   if (!result.has_more) return pages;
   if (!result.next_cursor || result.next_cursor === cursor) throw new AppError(502,'Notion 페이지 구분자를 확인할 수 없습니다.');
   cursor = result.next_cursor;
  }
  throw new AppError(413,'Notion 목록 조회 상한에 도달했습니다.');
 }
 private async find(kind: RecordKind, id: string) { const pages = await this.query(kind,id); if (pages.length>1) throw new AppError(409,'같은 App ID의 Notion 페이지가 여러 개 있습니다. 중복 페이지를 확인해 주세요.'); return pages[0]; }
 private async activityMap() { const pages = await this.query('activity'); return new Map(pages.map(p=>[p.id.replaceAll('-',''),readText(p.properties['App ID'])])); }
 async read() {
  await this.checkSchema();
  const activityPages = await this.query('activity'); const ids = new Map(activityPages.map(p=>[p.id.replaceAll('-',''),readText(p.properties['App ID'])]));
  const activities = activityPages.map(p=>fromPage('activity',p,ids) as Activity);
  const entries = (await this.query('entry')).map(p=>fromPage('entry',p,ids) as Entry);
  try { decode(JSON.stringify({version:1,revision:0,activities,entries})); } catch { throw new AppError(422,'Notion 기록에 잘못된 날짜·상태·링크 또는 중복 App ID가 있습니다. 원본 데이터를 확인해 주세요.'); }
  return {activities,entries};
 }
 async save(kind: RecordKind, input: unknown): Promise<RemoteRecord> {
  let record: ArchiveRecord; try { record = validateRecord(kind,input); } catch (error) { throw new AppError(400,error instanceof Error ? error.message : '저장할 기록이 올바르지 않습니다.'); }
  return this.journal.locked(this.namespace,async()=>{
   await this.checkSchema(kind === 'entry' && !!(record as Entry).calendarEvent, kind === 'entry' && !!(record as Entry).sourceLinks?.length, kind === 'entry' ? record as Entry : undefined);
   const existing = await this.find(kind,record.id); const key = `${this.namespace}:${kind}:${record.id}`;
   const map = kind === 'entry' ? await this.activityMap() : new Map<string,string>();
   let activityPage: string | undefined;
   if (kind === 'entry' && (record as Entry).activityId) { const activity = await this.find('activity',(record as Entry).activityId!); if (!activity) throw new AppError(409,'연결할 활동을 먼저 Notion에 저장해 주세요.'); activityPage = activity.id; }
   if (existing) {
    this.journal.known(key,existing.id);
    const remote = fromPage(kind,existing,map); const remoteHash = fingerprint(remote);
    if (remoteHash === fingerprint(record)) return {kind,record:remote};
    if (!record.notion || record.notion.pageId.replaceAll('-','') !== existing.id.replaceAll('-','') || record.notion.hash !== remoteHash) throw new AppError(409,'Notion에서도 내용이 바뀌었습니다. 두 버전을 확인해 주세요.',undefined,{kind,record:remote});
    const nextProperties = properties(kind,record,activityPage);
    const clearedLinks = kind === 'entry' && (remote as Entry).sourceLinks?.length && !(record as Entry).sourceLinks?.length;
    await this.api.call('/pages/'+existing.id,'PATCH',{properties:{
     ...nextProperties,
     ...(kind === 'entry' && (remote as Entry).photo && !(record as Entry).photo ? { [photoProperty]: { rich_text: [] } } : {}),
     ...(kind === 'entry' && (remote as Entry).travelReferences && !(record as Entry).travelReferences ? { [travelProperty]: { rich_text: [] } } : {}),
     ...(clearedLinks ? { [sourceLinksProperty]: { rich_text: [] } } : {}),
    }});
    const updated = await this.api.call<NotionPage>('/pages/'+existing.id);
    return {kind,record:fromPage(kind,updated,map)};
   }
   if (record.notion) throw new AppError(409,'연결했던 Notion 페이지가 없어졌거나 휴지통에 있습니다. 자동으로 다시 만들지 않습니다.');
   const reserved = this.journal.creation(key);
   if (reserved) throw new AppError(409,'이전 새 페이지 저장 결과가 불명확합니다. 중복 방지를 위해 재생성을 중단했습니다. Notion에서 App ID를 확인한 뒤 다시 불러오세요.');
   this.journal.reserve(key);
   let created: NotionPage;
   try { created = await this.api.call<NotionPage>('/pages','POST',{parent:{type:'data_source_id',data_source_id:this.source(kind)},properties:properties(kind,record,activityPage)}); }
   catch(error) { if (error instanceof NotionError && ((error.upstreamStatus>=400 && error.upstreamStatus<500) || error.upstreamStatus===529)) this.journal.rejected(key); throw error; }
   if (!created.id) throw new AppError(502,'Notion 저장 결과를 확인할 수 없습니다. 다시 불러와 확인해 주세요.');
   this.journal.known(key,created.id);
   return {kind,record:fromPage(kind,created,map)};
  });
 }
}
