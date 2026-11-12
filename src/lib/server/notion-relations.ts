import type { Transport } from './notion-client.ts';
import type { NotionPage } from './notion-mapping.ts';
import { AppError } from './config.ts';

export const notionRelationId = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
export const compactNotionId = (id: string) => id.replaceAll('-', '').toLowerCase();
type RelationList = { results: { relation?: { id: string } }[]; has_more: boolean; next_cursor?: string };

export async function readRelation(api: Transport, page: NotionPage, name: string) {
 const property = page.properties[name];
 if (!property?.relation) return [];
 const ids = new Set(property.relation.map(row => row.id));
 if (property.has_more && property.id) {
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
   const result: RelationList = await api.call('/pages/' + page.id + '/properties/' + property.id +
    '?page_size=100' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''));
   for (const row of result.results) if (row.relation?.id) ids.add(row.relation.id);
   if (!result.has_more) break;
   cursor = result.next_cursor;
   if (!cursor || seen.has(cursor) || seen.size >= 49) throw new AppError(502, 'Notion 관계의 조회 범위를 확인해 주세요.');
   seen.add(cursor);
  } while (cursor);
 }
 return [...new Set([...ids].filter(id => notionRelationId.test(id)).map(compactNotionId))];
}
