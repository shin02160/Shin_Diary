import type { CollectionItem, CollectionResult, NotionCollections } from '../notion-collections.ts';
import { AppError } from './config.ts';
import type { Transport } from './notion-client.ts';
import { readText, type NotionPage } from './notion-mapping.ts';

const validId = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
interface Result { results: NotionPage[]; has_more: boolean; next_cursor?: string }
export interface CollectionSources { trips?: string; itinerary?: string; performances?: string }
type CollectionKind = keyof CollectionSources;
const fields = {
 trips: { name: '여행명', date: '여행기간' },
 itinerary: { name: '일정명', date: '일시' },
 performances: { name: '공연명', date: '날짜' },
} as const;

function date(value?: string | null) {
 return value && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function format(page: NotionPage, kind: CollectionKind, tripNames: Map<string, string>): CollectionItem | undefined {
 const props = page.properties;
 const keys = fields[kind];
 const title = readText(props[keys.name]).trim().slice(0, 180);
 if (!title) return;
 const id = page.id.replaceAll('-', '').toLowerCase();
 const sourceDate = props[keys.date]?.date;
 const text = (key: string) => (readText(props[key]).trim() || props[key]?.select?.name)?.slice(0, 200);
 const item = { id, title, url: 'https://www.notion.so/' + id, start: date(sourceDate?.start), end: date(sourceDate?.end) };
 if (kind === 'trips') return { ...item, location: text('여행지'), detail: text('상태') };
 if (kind === 'itinerary') {
  const relation = props['여행']?.relation?.[0]?.id;
  const trip = relation && tripNames.get(relation.replaceAll('-', '').toLowerCase());
  return { ...item, location: text('장소'), detail: [trip, text('구분')].filter(Boolean).join(' · ') };
 }
 return { ...item, location: [text('도시'), text('장소')].filter(Boolean).join(' · '),
  detail: props['아티스트']?.multi_select?.map(value => value.name).join(', ').slice(0, 300),
  memo: readText(props['비고']).trim().slice(0, 500) || undefined };
}

async function readSource(api: Transport, source: string | undefined, kind: CollectionKind, tripNames = new Map<string, string>()): Promise<CollectionResult> {
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
    const item = format(page, kind, tripNames);
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
 const tripsRequest = readSource(api, sources.trips, 'trips');
 const performancesRequest = readSource(api, sources.performances, 'performances');
 const trips = await tripsRequest;
 const tripNames = new Map(trips.state === 'ready' ? trips.items.map(item => [item.id, item.title]) : []);
 const [itinerary, performances] = await Promise.all([readSource(api, sources.itinerary, 'itinerary', tripNames), performancesRequest]);
 return { trips, itinerary, performances };
}
