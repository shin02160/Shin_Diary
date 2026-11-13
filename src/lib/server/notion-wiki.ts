import { AppError } from './config.ts';
import { NotionError, type Transport } from './notion-client.ts';
import type { WikiPage } from '../wiki.ts';

import { normalized, readWikiBlocks, richText, safeLink, type Rich } from './notion-blocks.ts';

interface Page {
 id: string; object: string; url?: string; archived?: boolean; in_trash?: boolean;
 parent?: { type: string; page_id?: string };
 properties?: Record<string, { type: string; title?: Rich[] }>;
}

export function wikiRootId(value: string | undefined) {
 const trimmed = value?.trim();
 if (!trimmed) throw new AppError(503, '개인 위키 시작 페이지가 설정되지 않았습니다. 서버의 NOTION_WIKI_PAGE_ID를 설정해 주세요.');
 const id = normalized(trimmed);
 if (!id) throw new AppError(503, '개인 위키 시작 페이지 ID 형식이 올바르지 않습니다. NOTION_WIKI_PAGE_ID에 페이지 ID를 입력해 주세요.');
 return id;
}

async function readWikiResource<T>(api: Transport, path: string, isRoot: boolean): Promise<T> {
 try {
  return await api.call<T>(path);
 } catch (error) {
  if (!(error instanceof NotionError)) throw error;
  if (error.upstreamStatus === 401) throw new AppError(502, 'Notion 연결 인증에 실패했습니다. 서버의 NOTION_TOKEN을 확인해 주세요.');
  if (error.upstreamStatus === 403) throw new AppError(502, 'Notion에서 위키 읽기를 허용하지 않았습니다. 연결의 읽기 권한을 확인해 주세요.');
  if (error.upstreamStatus === 404) {
   if (isRoot) throw new AppError(503, 'Notion에서 위키 시작 페이지를 열 수 없습니다. 페이지 ID와 Notion 연결 공유를 확인해 주세요.');
   throw new AppError(404, '이 위키 페이지를 열 수 없습니다. 페이지가 존재하고 Notion 연결에 공유되어 있는지 확인해 주세요.');
  }
  throw error;
 }
}

export async function readWiki(api: Transport, rootId: string | undefined, pageId?: string): Promise<WikiPage> {
 const root = wikiRootId(rootId);
 const id = pageId === undefined ? root : normalized(pageId);
 if (!id) throw new AppError(400, '올바른 위키 페이지를 선택해 주세요.');
 const loadPage = (key: string) => readWikiResource<Page>(api, '/pages/' + key, key === root);
 const current = await loadPage(id);
 if (current.object !== 'page' || current.archived || current.in_trash) throw new AppError(404, '위키 페이지를 찾지 못했습니다.');
 const parentOf = (page: Page) => page.parent?.type === 'page_id' ? normalized(page.parent.page_id ?? '') : '';
 const parent = id === root ? undefined : parentOf(current);
 let ancestor = parent;
 for (let depth = 0; ancestor && ancestor !== root && depth < 7; depth++) {
  ancestor = parentOf(await loadPage(ancestor));
 }
 if (id !== root && ancestor !== root) throw new AppError(404, '개인 위키에서 열 수 없는 페이지입니다.');
 const title = Object.values(current.properties ?? {}).find(property => property.type === 'title');
 const body = await readWikiBlocks(path => readWikiResource(api, path, id === root), id);
 return { id, title: richText(title?.title).map(item => item.text).join('') || '개인 위키',
  url: safeLink(current.url, true), parent, ...body };
}
