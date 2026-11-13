import type { WikiBlock, WikiText } from '../wiki.ts';

export type Rich = {
 plain_text?: string; href?: string; mention?: { type?: string; page?: { id?: string } };
 annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean; underline?: boolean };
};
interface Block {
 id: string; type: string; has_children: boolean;
 [key: string]: unknown;
}
interface BlockList { results: Block[]; has_more: boolean; next_cursor?: string }
interface BlockData {
 rich_text?: Rich[]; caption?: Rich[]; title?: string; checked?: boolean; url?: string;
 external?: { url?: string }; file?: { url?: string }; synced_from?: unknown;
 cells?: Rich[][]; has_column_header?: boolean; has_row_header?: boolean;
}
const types = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item',
 'numbered_list_item', 'to_do', 'quote', 'callout', 'toggle', 'code', 'divider', 'child_page', 'bookmark',
 'column', 'column_list', 'synced_block', 'image']);
// Shown in entry stories only: tables, and attachments that can be opened as a link.
const linked = { embed: '임베드', video: '동영상', audio: '오디오', file: '첨부 파일', pdf: 'PDF', link_preview: '링크' } as const;
const entryTypes = new Set(['table', 'table_row', ...Object.keys(linked)]);
// Decorative blocks carry no content of their own.
const silent = new Set(['table_of_contents', 'breadcrumb']);
const omittedLabels: Record<string, string> = {
 child_page: '하위 페이지', link_to_page: '페이지 링크', child_database: '데이터베이스', synced_block: '동기화 블록',
 equation: '수식', image: '사진', unsupported: 'Notion API가 제공하지 않는 블록', ...linked,
};

export function normalized(value: string) {
 return /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value) ? value.replaceAll('-', '').toLowerCase() : '';
}
export function safeLink(url?: string, allowHttp = false) {
 if (!url) return;
 try {
  const parsed = new URL(url);
  if ((parsed.protocol === 'https:' || (allowHttp && parsed.protocol === 'http:')) && !parsed.username && !parsed.password) return parsed.href;
 } catch { /* Display unsafe or malformed links as text. */ }
}
export function richText(items: Rich[] = [], allowHttp = false): WikiText[] {
 return items.map(item => {
  const { bold, italic, code, strikethrough, underline } = item.annotations ?? {};
  const page = item.mention?.type === 'page' ? normalized(item.mention.page?.id ?? '') : '';
  return { text: item.plain_text ?? '', url: safeLink(item.href, allowHttp),
   ...(page ? { page } : {}), ...(bold ? { bold } : {}), ...(italic ? { italic } : {}),
   ...(code ? { code } : {}), ...(strikethrough ? { strikethrough } : {}), ...(underline ? { underline } : {}) };
 });
}

export async function readWikiBlocks(load: (path: string) => Promise<BlockList>, id: string, entry = false) {
 let remaining = entry ? 600 : 180;
 let truncated = false;
 // Entry stories name what could not be shown, so a missing table is not mistaken for a short story.
 let partial = false;
 const omitted: Record<string, number> = {};
 const cut = () => { truncated = true; partial = true; };
 const omit = (type: string) => {
  truncated = true;
  const label = omittedLabels[type] ?? type;
  omitted[label] = (omitted[label] ?? 0) + 1;
 };
 const seen = new Set<string>([id]);
 async function walk(parent: string, depth: number): Promise<WikiBlock[]> {
  if (depth > (entry ? 8 : 3) || remaining <= 0) { cut(); return []; }
  const result: WikiBlock[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
   let list: BlockList;
   try {
    list = await load('/blocks/' + parent + '/children?page_size=100' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''));
   } catch (error) {
    if (!entry || (depth === 0 && !cursor)) throw error;
    cut();
    return result;
   }
   for (const block of list.results) {
    if (remaining-- <= 0) { cut(); return result; }
    const key = normalized(block.id);
    if (!key || seen.has(key)) { cut(); continue; }
    seen.add(key);
    const data = block[block.type] as BlockData | undefined;
    const restricted = entry && (['child_page', 'link_to_page', 'child_database'].includes(block.type) ||
     (block.type === 'synced_block' && Boolean(data?.synced_from)));
    if (restricted || !(types.has(block.type) || (entry && entryTypes.has(block.type)))) {
     if (entry && !silent.has(block.type)) omit(block.type);
     continue;
    }
    const text = richText(data?.rich_text, !entry);
    if (block.type === 'child_page') text.push({ text: data?.title || '하위 페이지' });
    if (block.type === 'bookmark' && data?.url) text.push({ text: data.url, url: safeLink(data.url, !entry) });
    if (block.type in linked) {
     const url = safeLink(data?.url ?? data?.external?.url ?? data?.file?.url);
     if (!url) { omit(block.type); continue; }
     const caption = richText(data?.caption).map(item => item.text).join('').trim();
     text.push({ text: caption || linked[block.type as keyof typeof linked] + ' 열기', url });
    }
    const image = block.type === 'image' ? safeLink(data?.file?.url ?? data?.external?.url) : undefined;
    if (block.type === 'image' && !image && entry) omit('image');
    result.push({ id: key, kind: block.type, text, page: block.type === 'child_page' ? key : undefined,
     checked: block.type === 'to_do' ? data?.checked === true : undefined,
     image, caption: block.type === 'image' ? richText(data?.caption) : undefined,
     ...(block.type === 'table' ? { columnHeader: data?.has_column_header === true, rowHeader: data?.has_row_header === true } : {}),
     ...(block.type === 'table_row' ? { cells: (data?.cells ?? []).map(cell => richText(cell)) } : {}),
     children: block.has_children && block.type !== 'child_page' ? await walk(key, depth + 1) : [] });
   }
   if (!list.has_more) break;
   cursor = list.next_cursor;
   if (!cursor || cursors.has(cursor) || remaining <= 0) { cut(); break; }
   cursors.add(cursor);
  } while (cursor);
  return result;
 }
 const blocks = await walk(id, 0);
 return { blocks, truncated, ...(entry && partial ? { partial } : {}), ...(Object.keys(omitted).length ? { omitted } : {}) };
}
