import { AppError } from './config.ts';
import { NotionError, type Transport } from './notion-client.ts';
import { normalized, readWikiBlocks } from './notion-blocks.ts';
import { readRelation } from './notion-relations.ts';
import type { NotionPage } from './notion-mapping.ts';
import type { WikiEntryBody } from '../wiki.ts';

interface Page {
 id: string;
 object: string;
 archived?: boolean;
 in_trash?: boolean;
 parent?: { type: string; data_source_id?: string };
 last_edited_time?: string;
 properties?: NotionPage['properties'];
}

export async function readWikiEntry(api: Transport, entriesId: string, pageId: string): Promise<WikiEntryBody> {
 const id = normalized(pageId);
 if (!id) throw new AppError(400, '올바른 기록을 선택해 주세요.');
 const source = normalized(entriesId);
 if (!source) throw new AppError(503, 'Notion Entries 데이터 소스 설정을 확인해 주세요.');
 const notFound = () => new AppError(404, 'Wiki에서 열 수 있는 기록을 찾지 못했어요.');
 let page: Page;
 try {
  page = await api.call<Page>('/pages/' + id);
 } catch (error) {
  if (error instanceof NotionError && error.upstreamStatus === 404) throw notFound();
  throw error;
 }
 if (page.object !== 'page' || normalized(page.id ?? '') !== id || page.archived || page.in_trash ||
  page.parent?.type !== 'data_source_id' || normalized(page.parent.data_source_id ?? '') !== source) throw notFound();

 const body = await readWikiBlocks(path => api.call(path), id, true);
 const result: WikiEntryBody = { ...body, updatedAt: page.last_edited_time };
 if (page.properties?.Activity?.relation) {
  try {
   result.activityIds = await readRelation(api, { id, properties: page.properties }, 'Activity');
  } catch {
   result.activityLinksUnavailable = true;
  }
 }
 return result;
}
