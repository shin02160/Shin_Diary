import { deriveScheduleState } from '../calendar/schedule-state.ts';
import { archiveCalendarOverlaps, type ArchiveCalendarEvent } from '../calendar/archive.ts';
import { parseActivityDate } from '../activity-view.ts';
import type { Transport } from './notion-client.ts';
import { readText, type NotionPage } from './notion-mapping.ts';
import { AppError } from './config.ts';
import { compactNotionId, notionRelationId, readRelation } from './notion-relations.ts';
import { readCalendarPage } from './calendar-repository.ts';

interface PageList { results: NotionPage[]; has_more: boolean; next_cursor?: string }
const sourceId = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;

export async function archivePages(api: Transport, source: string, filter?: object) {
 if (!sourceId.test(source)) throw new AppError(503, 'Notion 데이터 소스 ID를 확인해 주세요.');
 const pages: NotionPage[] = [];
 const seen = new Set<string>();
 let cursor: string | undefined;
 do {
  const result: PageList = await api.call('/data_sources/' + source + '/query', 'POST', {
   page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}),
  });
  pages.push(...result.results.filter(page => page.object === 'page' && !page.archived && !page.in_trash && sourceId.test(page.id)));
  if (!result.has_more) break;
  cursor = result.next_cursor;
  if (!cursor || seen.has(cursor) || seen.size >= 49) throw new AppError(422, 'Notion 자료의 조회 범위를 확인해 주세요.');
  seen.add(cursor);
 } while (cursor);
 return pages;
}

export function archiveCalendarEvent(page: NotionPage, now = Date.now()): ArchiveCalendarEvent | undefined {
 const p = page.properties;
 const text = (key: string) => readText(p[key]).trim();
 const importKey = text('Import Key');
 const title = text('Name');
 const allDay = p['All Day']?.checkbox === true;
 const wallStart = text('Wall Start') || p.Start?.date?.start || '';
 const wallEnd = text('Wall End') || p.End?.date?.start || wallStart;
 const valid = (value: string) => Boolean(parseActivityDate(value)) && (allDay ? value.length === 10 : value.length > 10);
 if (!importKey || !title || !valid(wallStart) || !valid(wallEnd) || wallEnd < wallStart) return;
 let id = 'notion-calendar:' + importKey;
 if (text('Source Calendar ID')) {
  try { id = readCalendarPage(page).event.id; } catch { /* Keep the original Import Key as the read identity. */ }
 }
 const rawStatus = p.Status?.select?.name ?? p.Status?.status?.name ?? undefined;
 const sourceStatus = rawStatus === 'confirmed' || rawStatus === 'tentative' || rawStatus === 'cancelled' ? rawStatus : 'unknown';
 const event: ArchiveCalendarEvent = {
  id, importKey, pageId: page.id.replaceAll('-', '').toLowerCase(), title, wallStart, wallEnd, allDay,
  sourceName: text('Source Calendar Name') || 'Notion',
  originalTimezone: text('Original Time Zone') || undefined,
  description: text('Description'), location: text('Location') || undefined,
  status: sourceStatus, rawStatus, sourceStatus, endExclusive: p['End Exclusive']?.checkbox,
  endInstant: !allDay && /(?:Z|[+-]\d{2}:\d{2})$/i.test(p.End?.date?.start ?? '') ? p.End?.date?.start : undefined,
 };
 return { ...event, scheduleState: deriveScheduleState(event, now) };
}

export async function readLifeCalendar(api: Transport, source: string, from = '', to = '', interest?: string) {
 if ([from, to].some(value => value && (value.length !== 10 || !parseActivityDate(value))) || (from && to && from > to)) {
  throw new AppError(400, '조회 시작일과 종료일을 확인해 주세요.');
 }
 if (interest !== undefined && !notionRelationId.test(interest)) throw new AppError(400, '관심사 주소를 확인해 주세요.');
 const pages = await archivePages(api, source, { property: 'Import Key', rich_text: { is_not_empty: true } });
 const events = new Map<string, ArchiveCalendarEvent>();
 let skipped = 0;
 const now = Date.now();
 for (const page of pages) {
  const event = archiveCalendarEvent(page, now);
  if (!event) { skipped++; continue; }
  if (events.has(event.importKey) || !archiveCalendarOverlaps(event, from, to)) continue;
  event.interestIds = await readRelation(api, page, '관련 관심사');
  if (interest && !event.interestIds.includes(compactNotionId(interest))) continue;
  event.activityIds = await readRelation(api, page, '관련 활동');
  events.set(event.importKey, event);
 }
 return { events: [...events.values()]
  .sort((a, b) => a.wallStart.localeCompare(b.wallStart)), skipped };
}
