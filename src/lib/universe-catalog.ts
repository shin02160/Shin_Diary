import { archiveCalendarEndDay, archiveCalendarHref, type ArchiveCalendarEvent } from './calendar/archive.ts';
import { calendarType } from './calendar/classification.ts';
import { deriveScheduleState, scheduleActivityStatus, type ScheduleState } from './calendar/schedule-state.ts';
import { activityStatus, deduplicateActivities, notionActivityUrl, parseActivityDate, type ActivityView } from './activity-view.ts';
import { dateKey } from './dates.ts';
import type { NotionCollections } from './notion-collections.ts';
import type { Activity, Entry } from './types.ts';

export type CatalogKind = 'travel' | 'concert' | 'daily' | 'project' | 'uncategorized';
export const catalogLabels: Record<CatalogKind, string> = { travel: '여행', concert: '공연', daily: '일상', project: '프로젝트', uncategorized: '미분류' };
export interface CatalogItem extends ActivityView {
 key: string;
 scheduleState?: ScheduleState;
 kind: CatalogKind;
 title: string;
 type: '여행' | '공연' | '기록' | '활동' | '일정' | '타임라인 이벤트';
 start?: string;
 end?: string;
 updated?: string;
 location?: string;
 detail?: string;
 summary?: string;
 cover?: string;
 url?: string;
 detailHref?: string;
 entry?: Entry;
 activity?: Activity;
 tags: string[];
}
const kinds = { Travel: 'travel', Concert: 'concert', Daily: 'daily', Projects: 'project' } as const;

export function mergeCatalogEntries(remote: Entry[], local: Entry[]) {
 const ids = new Set(remote.map(entry => entry.id));
 const pages = new Set(remote.map(entry => entry.notion?.pageId.replaceAll('-', '').toLowerCase()).filter(Boolean));
 return [...remote, ...local.filter(entry => !ids.has(entry.id) &&
  (!entry.notion || !pages.has(entry.notion.pageId.replaceAll('-', '').toLowerCase())))];
}

export function buildCatalog(archive?: { activities: Activity[]; entries: Entry[] }, collections?: NotionCollections): CatalogItem[] {
 const result: CatalogItem[] = [];
 for (const [source, kind, type] of [['trips', 'travel', '여행'], ['performances', 'concert', '공연']] as const) {
  const group = collections?.[source];
  if (group?.state !== 'ready') continue;
  for (const item of group.items) result.push({
   sourceType: source, sourcePageId: item.id, category: kind, interestIds: [],
   startAt: parseActivityDate(item.start, item.timezone), endAt: parseActivityDate(item.end, item.timezone),
   status: activityStatus(source === 'trips' ? item.sourceStatus : undefined), originalUrl: item.url, updatedAt: item.updatedAt,
   key: source + ':' + item.id, kind, type, title: item.title, start: item.start, end: item.end,
   updated: source === 'performances' ? item.updatedAt : undefined, location: item.location, detail: item.detail, summary: item.memo,
   cover: item.cover, url: item.url, detailHref: '/explore/' + source + '/' + item.id, tags: [],
  });
 }
 for (const entry of archive?.entries ?? []) {
  if (entry.isSample) continue;
  result.push({
   sourceType: 'entry', sourcePageId: entry.notion?.pageId || entry.id, category: kinds[entry.category], interestIds: [],
   detailHref: entry.notion?.pageId ? '/wiki?entry=' + encodeURIComponent(entry.id) : undefined,
   startAt: entry.occurredAt, status: 'unknown', originalUrl: notionActivityUrl(entry.notion?.pageId),
   key: 'entry:' + entry.id, kind: kinds[entry.category], type: '기록',
   title: entry.title || entry.content.trim().slice(0, 64) || (entry.photo ? '사진 기록' : '링크 기록'),
   start: dateKey(entry.occurredAt), updated: entry.createdAt, location: entry.place, detail: entry.mood,
   summary: entry.content, cover: entry.photo, entry, tags: entry.tags,
  });
 }
 for (const activity of archive?.activities ?? []) {
  if (activity.isSample) continue;
  result.push({
   sourceType: 'activity', sourcePageId: activity.notion?.pageId || activity.id, category: kinds[activity.category], interestIds: [],
   status: 'unknown', originalUrl: notionActivityUrl(activity.notion?.pageId), updatedAt: activity.updatedAt,
   key: 'activity:' + activity.id, kind: kinds[activity.category], type: '활동',
   title: activity.name, updated: activity.updatedAt, summary: activity.summary,
   activity, tags: activity.tags,
  });
 }
 return deduplicateActivities(result).sort((a, b) => (b.updated || b.start || '').localeCompare(a.updated || a.start || '') || a.title.localeCompare(b.title, 'ko'));
}

export function filterCatalog(items: CatalogItem[], kind: CatalogKind | 'all', query: string, year: string, tag: string) {
 const search = query.trim().toLocaleLowerCase('ko-KR');
 return items.filter(item => (!year || (item.start || item.updated)?.startsWith(year)) &&
  (kind === 'all' || item.kind === kind) && (!tag || item.tags.includes(tag)) &&
  [item.title, item.location, item.detail, ...item.tags].join(' ').toLocaleLowerCase('ko-KR').includes(search));
}

export function calendarCatalogItem(event: ArchiveCalendarEvent, now: number): CatalogItem {
 const state = event.scheduleState ?? deriveScheduleState(event, now);
 const type = calendarType(event);
 const kind = type === 'travel' || type === 'concert' ? type : type === 'work' ? 'project' :
  type === 'exercise' || type === 'appointment' ? 'daily' : 'uncategorized';
 return {
  key: event.id, sourceType: 'calendar', sourcePageId: event.pageId, title: event.title, type: '일정',
  kind, category: kind, interestIds: event.interestIds ?? [], tags: [], status: scheduleActivityStatus[state],
  scheduleState: state, start: event.wallStart, end: archiveCalendarEndDay(event),
  startAt: parseActivityDate(event.wallStart), endAt: parseActivityDate(archiveCalendarEndDay(event)),
  originalUrl: notionActivityUrl(event.pageId), location: event.location, detailHref: archiveCalendarHref(event),
 };
}
