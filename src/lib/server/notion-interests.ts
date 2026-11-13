import type { Interest, InterestResult } from '../interests.ts';
import { parseActivityDate } from '../activity-view.ts';
import { archivePages } from './life-calendar.ts';
import { AppError } from './config.ts';
import { NotionError, type Transport } from './notion-client.ts';
import { readRelation } from './notion-relations.ts';
import { readText, type NotionPage } from './notion-mapping.ts';

const idPattern = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const normalize = (id: string) => id.replaceAll('-', '').toLowerCase();

interface InterestPage extends NotionPage {
 parent?: { type: string; data_source_id?: string };
}
interface PageList { results: InterestPage[]; has_more: boolean; next_cursor?: string }
const recordRelations = ['관련 기록', '관련 활동', 'RelatedActivities'];

function recordRelationNames(page: InterestPage) {
 return recordRelations.filter(name => Array.isArray(page.properties[name]?.relation));
}

function safeCover(value?: string) {
 if (!value) return;
 try {
  const url = new URL(value);
  if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
 } catch { /* Use the default cover. */ }
}

function mapInterest(page: InterestPage): Interest | undefined {
 if (page.object !== 'page' || page.archived || page.in_trash || !idPattern.test(page.id)) return;
 const p = page.properties;
 const name = readText(p['주제'] ?? p.Name).trim();
 if (!name) return;
 const relations = recordRelationNames(page).map(name => p[name]);
 const startedAt = (p['date:기간 시작:start'] ?? p.StartedAt)?.date?.start?.slice(0, 10);
 const endedAt = p['date:기간 종료:start']?.date?.start?.slice(0, 10);
 const lastReviewedAt = p.LastReviewedAt?.date?.start?.slice(0, 10);
 const file = p.Cover?.files?.[0];
 return {
  id: normalize(page.id), name,
  category: (p['카테고리'] ?? p.Category)?.select?.name, status: p.Status?.select?.name ?? p.Status?.status?.name,
  startedAt: parseActivityDate(startedAt) ? startedAt : undefined,
  endedAt: parseActivityDate(endedAt) ? endedAt : undefined,
  memo: readText(p['메모']).trim() || undefined,
  lastReviewedAt: parseActivityDate(lastReviewedAt) ? lastReviewedAt : undefined,
  preferenceLevel: (p['강도'] ?? p.PreferenceLevel)?.select?.name,
  why: readText(p.WhyILikeIt).trim() || undefined,
  cover: safeCover(file?.file?.url ?? file?.external?.url ?? p.Cover?.url ?? undefined),
  tags: p.Tags?.multi_select?.map(tag => tag.name) ?? [],
  relatedPageIds: [...new Set(relations.flatMap(property => property.relation ?? []).map(row => row.id).filter(id => idPattern.test(id)).map(normalize))],
  moreRelations: relations.some(property => property.has_more === true),
 };
}

export async function readInterests(api: Transport, sourceId?: string, interestId?: string, activitiesSource?: string): Promise<InterestResult> {
 const source = sourceId?.trim();
 if (!source) return { configured: false, interests: [] };
 if (!idPattern.test(source)) throw new AppError(503, '관심사 Notion 데이터 소스 ID를 확인해 주세요.');
 if (interestId !== undefined) {
  if (!idPattern.test(interestId)) throw new AppError(400, '관심사 주소가 올바르지 않습니다.');
  let page: InterestPage;
  try { page = await api.call('/pages/' + normalize(interestId)); }
  catch (error) {
   if (error instanceof NotionError && error.upstreamStatus === 404) throw new AppError(404, '관심사를 찾을 수 없습니다.');
   throw error;
  }
  const parent = page.parent;
  const interest = mapInterest(page);
  if (!interest || parent?.type !== 'data_source_id' || !parent.data_source_id || normalize(parent.data_source_id) !== normalize(source)) {
   throw new AppError(404, '관심사를 찾을 수 없습니다.');
  }
  if (interest.moreRelations) {
   const relations = await Promise.all(recordRelationNames(page).map(name => readRelation(api, page, name)));
   interest.relatedPageIds = [...new Set(relations.flat())];
   interest.moreRelations = false;
  }
  if (activitiesSource && idPattern.test(activitiesSource)) {
   const schema = await api.call<{ properties: Record<string, { type: string; relation?: { data_source_id?: string } }> }>('/data_sources/' + activitiesSource);
   const relation = schema.properties['관련 관심사'];
   if (relation?.type === 'relation' && normalize(relation.relation?.data_source_id ?? '') === normalize(source)) {
    const pages = await archivePages(api, activitiesSource, { property: '관련 관심사', relation: { contains: interest.id } });
    interest.relatedPageIds = [...new Set([...interest.relatedPageIds, ...pages.map(page => normalize(page.id))])];
   }
  }
  return { configured: true, interests: [interest] };
 }

 const items = new Map<string, Interest>();
 let cursor: string | undefined;
 for (let batch = 0; batch < 5; batch++) {
  const data: PageList = await api.call('/data_sources/' + source + '/query', 'POST', {
   page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
  });
  for (const page of data.results) {
   const item = mapInterest(page);
   if (item) {
    delete item.why;
    delete item.memo;
    items.set(item.id, item);
   }
  }
  const interests = () => [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (!data.has_more) return { configured: true, interests: interests() };
  if (!data.next_cursor || data.next_cursor === cursor) break;
  cursor = data.next_cursor;
 }
 return { configured: true, interests: [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')), truncated: true };
}
