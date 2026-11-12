import type { CollectionDetail, CollectionItem, CollectionKind, CollectionResult, NotionCollections, TravelSection } from '../notion-collections.ts';
import { AppError } from './config.ts';
import { NotionError, type Transport } from './notion-client.ts';
import { readText, type NotionPage } from './notion-mapping.ts';

const validId = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
interface ArchivePage extends NotionPage {
 last_edited_time?: string;
 parent?: { type: string; data_source_id?: string };
 cover?: { type?: string; file?: { url?: string }; external?: { url?: string } } | null;
}
interface Result { results: ArchivePage[]; has_more: boolean; next_cursor?: string }
export interface CollectionSources { trips?: string; performances?: string }
const fields = {
 trips: { name: '여행명', date: '여행기간' },
 performances: { name: '공연명', date: '날짜' },
} as const;

function date(value?: string | null) {
 return value && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function coverUrl(cover: ArchivePage['cover']) {
 const value = cover?.type === 'external' ? cover.external?.url : cover?.type === 'file' ? cover.file?.url : undefined;
 if (!value) return;
 try {
  const url = new URL(value);
  if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
 } catch { /* An unavailable cover leaves the image area empty. */ }
}

function format(page: ArchivePage, kind: CollectionKind): CollectionItem | undefined {
 const props = page.properties;
 const keys = fields[kind];
 const title = readText(props[keys.name]).trim().slice(0, 180);
 if (!title) return;
 const id = page.id.replaceAll('-', '').toLowerCase();
 const sourceDate = props[keys.date]?.date;
 const text = (key: string) => (readText(props[key]).trim() || props[key]?.select?.name)?.slice(0, 200);
 const item = { id, title, url: 'https://www.notion.so/' + id, start: date(sourceDate?.start), end: date(sourceDate?.end) };
 const timezone = sourceDate?.time_zone ?? undefined;
 if (kind === 'trips') return { ...item, timezone, location: text('여행지'), cover: coverUrl(page.cover),
  sourceStatus: props['상태']?.status?.name, updatedAt: date(page.last_edited_time) };
 return { ...item, timezone, cover: coverUrl(page.cover), updatedAt: date(page.last_edited_time), location: [text('도시'), text('장소')].filter(Boolean).join(' · '),
  detail: props['아티스트']?.multi_select?.map(value => value.name).join(', ').slice(0, 300) };
}

async function readSource(api: Transport, source: string | undefined, kind: CollectionKind): Promise<CollectionResult> {
 if (!source?.trim()) return { state: 'unconfigured' };
 const id = source.trim();
 if (!validId.test(id)) return { state: 'failed', message: 'Notion 데이터 소스 ID를 확인해 주세요.' };
 try {
  const items: CollectionItem[] = [];
  let cursor: string | undefined;
  for (let batch = 0; batch < 5; batch++) {
   const result: Result = await api.call('/data_sources/' + id + '/query', 'POST', {
    page_size: 100, sorts: [{ property: fields[kind].date, direction: 'descending' }],
    ...(cursor ? { start_cursor: cursor } : {}),
   });
   if (!Array.isArray(result.results)) throw new AppError(502, 'Notion 목록 응답을 확인할 수 없습니다.');
   for (const page of result.results) {
    if (page.object !== 'page' || page.archived || page.in_trash || !validId.test(page.id)) continue;
    const item = format(page, kind);
    if (item) items.push(item);
   }
   if (!result.has_more) return { state: 'ready', items, truncated: false };
   if (!result.next_cursor || result.next_cursor === cursor) throw new AppError(502, 'Notion 목록의 다음 페이지를 확인할 수 없습니다.');
   cursor = result.next_cursor;
  }
  return { state: 'ready', items, truncated: true };
 } catch (error) {
  return { state: 'failed', message: error instanceof AppError ? error.message : 'Notion 자료를 불러오지 못했습니다.' };
 }
}

export async function readNotionCollections(api: Transport, sources: CollectionSources): Promise<NotionCollections> {
 const [trips, performances] = await Promise.all([
  readSource(api, sources.trips, 'trips'),
  readSource(api, sources.performances, 'performances'),
 ]);
 return { trips, performances };
}

const travelSections = [
 { label: '일정', relation: '일정', date: '일시', status: '진행상태' },
 { label: '예약', relation: '예약', date: '이용일', status: '예약상태' },
 { label: '지출', relation: '지출', date: '결제일', status: '정산여부' },
 { label: '체크리스트', relation: '체크리스트', date: '기한', status: '상태' },
] as const;

const sameId = (a: string, b: string) => a.replaceAll('-', '').toLowerCase() === b.replaceAll('-', '').toLowerCase();

interface TravelSchema {
 properties: Record<string, { type: string; relation?: { data_source_id?: string } }>;
}

async function readTripSections(api: Transport, source: string, tripId: string): Promise<TravelSection[]> {
 let schema: TravelSchema;
 try {
  schema = await api.call<TravelSchema>('/data_sources/' + source);
 } catch {
  return travelSections.map(({ label }) => ({ label, records: [], unavailable: true }));
 }
 const sections: TravelSection[] = [];
 for (const group of travelSections) {
  const target = schema.properties[group.relation]?.relation?.data_source_id;
  if (!target || !validId.test(target)) {
   sections.push({ label: group.label, records: [], unavailable: true });
   continue;
  }
  try {
   const records: TravelSection['records'] = [];
   let cursor: string | undefined;
   for (let batch = 0; batch < 5; batch++) {
    const result = await api.call<Result>('/data_sources/' + target + '/query', 'POST', {
     page_size: 100,
     filter: { property: '여행', relation: { contains: tripId } },
     ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const page of result.results) {
     if (page.object !== 'page' || page.archived || page.in_trash || !validId.test(page.id)) continue;
     const properties = page.properties;
     const relation = properties['여행']?.relation;
     if (properties['여행']?.has_more || relation?.length !== 1 || !sameId(relation[0].id, tripId)) continue;
     const title = readText(Object.values(properties).find(property => property.type === 'title')).trim();
     if (!title) continue;
     const dates = properties[group.date]?.date;
     const status = properties[group.status];
     records.push({
      title,
      url: 'https://www.notion.so/' + page.id.replaceAll('-', ''),
      start: date(dates?.start),
      end: date(dates?.end),
      location: readText(properties['장소']).trim() || undefined,
      status: status?.status?.name || status?.select?.name,
     });
    }
    if (!result.has_more) {
     cursor = undefined;
     break;
    }
    if (!result.next_cursor || result.next_cursor === cursor) throw new Error('Invalid cursor');
    cursor = result.next_cursor;
   }
   records.sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999') || a.title.localeCompare(b.title, 'ko'));
   sections.push({ label: group.label, records, truncated: Boolean(cursor) });
  } catch {
   sections.push({ label: group.label, records: [], unavailable: true });
  }
 }
 return sections;
}

export async function readCollectionDetail(api: Transport, sources: CollectionSources, kind: CollectionKind, id: string): Promise<CollectionDetail> {
 if (!validId.test(id)) throw new AppError(400, '올바른 기록을 선택해 주세요.');
 const source = sources[kind]?.trim();
 if (!source || !validId.test(source)) throw new AppError(503, 'Notion 컬렉션 연결 설정을 확인해 주세요.');
 let page: ArchivePage;
 try {
  page = await api.call<ArchivePage>('/pages/' + id);
 } catch (error) {
  if (error instanceof NotionError && error.upstreamStatus === 404) throw new AppError(404, '컬렉션에서 이 기록을 열 수 없습니다.');
  throw error;
 }
 const parent = page.parent;
 if (page.object !== 'page' || page.archived || page.in_trash ||
     parent?.type !== 'data_source_id' || !parent.data_source_id || !sameId(parent.data_source_id, source)) {
  throw new AppError(404, '컬렉션에서 이 기록을 찾지 못했습니다.');
 }
 const item = format(page, kind);
 if (!item) throw new AppError(404, '컬렉션에서 이 기록을 찾지 못했습니다.');
 if (kind === 'trips') return { item, sections: await readTripSections(api, source, page.id) };

 const properties = page.properties;
 const cast = properties['캐스팅'];
 return {
  item,
  cast: readText(cast).trim() || cast?.multi_select?.map(value => value.name).join(', ') || cast?.select?.name,
  setlist: readText(properties['셋리']).trim() || undefined,
  memo: readText(properties['비고']).trim() || undefined,
 };
}
