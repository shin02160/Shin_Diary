import { dateKey } from './dates.ts';
import type { NotionCollections } from './notion-collections.ts';
import type { Activity, Entry } from './types.ts';

export type CatalogKind = 'travel' | 'concert' | 'daily' | 'project';
export const catalogLabels: Record<CatalogKind, string> = { travel: '여행', concert: '공연', daily: '일상', project: '프로젝트' };
export interface CatalogItem {
 key: string;
 kind: CatalogKind;
 title: string;
 type: '여행' | '공연' | '기록' | '활동';
 start?: string;
 end?: string;
 updated?: string;
 location?: string;
 detail?: string;
 summary?: string;
 cover?: string;
 url?: string;
 entry?: Entry;
 activity?: Activity;
 tags: string[];
}
const kinds = { Travel: 'travel', Concert: 'concert', Daily: 'daily', Projects: 'project' } as const;

export function buildCatalog(archive?: { activities: Activity[]; entries: Entry[] }, collections?: NotionCollections): CatalogItem[] {
 const result: CatalogItem[] = [];
 for (const [source, kind, type] of [['trips', 'travel', '여행'], ['performances', 'concert', '공연']] as const) {
  const group = collections?.[source];
  if (group?.state !== 'ready') continue;
  for (const item of group.items) result.push({
   key: source + ':' + item.id, kind, type, title: item.title, start: item.start, end: item.end,
   updated: item.updatedAt, location: item.location, detail: item.detail, summary: item.memo,
   cover: item.cover, url: item.url, tags: [],
  });
 }
 for (const entry of archive?.entries ?? []) {
  if (entry.isSample) continue;
  result.push({
   key: 'entry:' + entry.id, kind: kinds[entry.category], type: '기록',
   title: entry.title || entry.content.trim().slice(0, 64) || (entry.photo ? '사진 기록' : '링크 기록'),
   start: dateKey(entry.occurredAt), updated: entry.createdAt, location: entry.place, detail: entry.mood,
   summary: entry.content, cover: entry.photo, entry, tags: entry.tags,
  });
 }
 for (const activity of archive?.activities ?? []) {
  if (activity.isSample) continue;
  result.push({
   key: 'activity:' + activity.id, kind: kinds[activity.category], type: '활동',
   title: activity.name, updated: activity.updatedAt, summary: activity.summary,
   activity, tags: activity.tags,
  });
 }
 return result.sort((a, b) => (b.updated || b.start || '').localeCompare(a.updated || a.start || '') || a.title.localeCompare(b.title, 'ko'));
}

export function filterCatalog(items: CatalogItem[], kind: CatalogKind | 'all', query: string, year: string, tag: string) {
 const search = query.trim().toLocaleLowerCase('ko-KR');
 return items.filter(item => (!year || (item.start || item.updated)?.startsWith(year)) &&
  (kind === 'all' || item.kind === kind) && (!tag || item.tags.includes(tag)) &&
  [item.title, item.location, item.detail, ...item.tags].join(' ').toLocaleLowerCase('ko-KR').includes(search));
}
