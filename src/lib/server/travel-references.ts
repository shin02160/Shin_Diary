import { AppError } from './config.ts';
import { readText, type NotionPage } from './notion-mapping.ts';
import type { Transport } from './notion-client.ts';

const idPattern = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
export type TravelSources = Record<'trips' | 'booking' | 'expense' | 'receipt', string>;
interface PageList { results: NotionPage[]; has_more: boolean; next_cursor: string | null }

async function query(api: Transport, source: string, filter?: object) {
 const pages: NotionPage[] = [];
 let cursor: string | undefined;
 for (let batch = 0; batch < 5; batch++) {
  const result = await api.call<PageList>('/data_sources/' + source + '/query', 'POST', {
   page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}),
  });
  pages.push(...result.results.filter(page => page.object === 'page' && !page.archived && !page.in_trash && idPattern.test(page.id)));
  if (!result.has_more) return pages;
  if (!result.next_cursor || result.next_cursor === cursor) throw new AppError(502, '여행 자료 목록을 확인하지 못했습니다.');
  cursor = result.next_cursor;
 }
 throw new AppError(413, '여행 자료가 500건을 넘습니다. 원본 페이지 주소를 직접 입력해 주세요.');
}

const normalize = (id: string) => id.replaceAll('-', '').toLowerCase();
const title = (page: NotionPage, property: string) => readText(page.properties[property]).trim().slice(0, 180);

export async function travelChoices(api: Transport, sources: TravelSources, trip?: string) {
 if (!Object.values(sources).every(source => idPattern.test(source))) throw new AppError(503, 'Travel Hub 데이터 소스 설정을 확인해 주세요.');
 if (trip && !idPattern.test(trip)) throw new AppError(400, '여행을 다시 선택해 주세요.');
 const trips = await query(api, sources.trips);
 if (!trip) return { trips: trips.flatMap(page => {
  const name = title(page, '여행명');
  return name ? [{ id: page.id, name }] : [];
 }) };
 const selected = trips.find(page => normalize(page.id) === normalize(trip));
 if (!selected) throw new AppError(404, '연결된 여행 마스터에서 이 여행을 찾지 못했습니다.');
 const groups = [['booking', '예약명'], ['expense', '지출명'], ['receipt', '영수증명']] as const;
 const resources = await Promise.all(groups.map(async ([kind, nameProperty]) => {
  const pages = await query(api, sources[kind], { property: '여행', relation: { contains: selected.id } });
  return [kind, pages.flatMap(page => {
   const relation = page.properties['여행'];
   const name = title(page, nameProperty);
   if (!name || relation?.has_more || relation?.relation?.length !== 1 ||
       normalize(relation.relation[0].id) !== normalize(selected.id)) return [];
   return [{ name, url: 'https://www.notion.so/' + normalize(page.id) }];
  })] as const;
 }));
 return { resources: Object.fromEntries(resources) };
}
