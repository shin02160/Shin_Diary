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
}
const types = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item',
 'numbered_list_item', 'to_do', 'quote', 'callout', 'toggle', 'code', 'divider', 'child_page', 'bookmark',
 'column', 'column_list', 'synced_block', 'image']);

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
 const seen = new Set<string>([id]);
 async function walk(parent: string, depth: number): Promise<WikiBlock[]> {
  if (depth > (entry ? 8 : 3) || remaining <= 0) { truncated = true; return []; }
  const result: WikiBlock[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
   let list: BlockList;
   try {
    list = await load('/blocks/' + parent + '/children?page_size=100' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''));
   } catch (error) {
    if (!entry || (depth === 0 && !cursor)) throw error;
    truncated = true;
    return result;
   }
   for (const block of list.results) {
    if (remaining-- <= 0) { truncated = true; return result; }
    const key = normalized(block.id);
    if (!key || seen.has(key)) { truncated = true; continue; }
    seen.add(key);
    const data = block[block.type] as BlockData | undefined;
    const restricted = entry && (['child_page', 'link_to_page', 'child_database'].includes(block.type) ||
     (block.type === 'synced_block' && Boolean(data?.synced_from)));
    if (restricted || !types.has(block.type)) {
     if (entry) truncated = true;
     continue;
    }
    const text = richText(data?.rich_text, !entry);
    if (block.type === 'child_page') text.push({ text: data?.title || '하위 페이지' });
    if (block.type === 'bookmark' && data?.url) text.push({ text: data.url, url: safeLink(data.url, !entry) });
    const image = block.type === 'image' ? safeLink(data?.file?.url ?? data?.external?.url) : undefined;
    if (block.type === 'image' && !image && entry) truncated = true;
    result.push({ id: key, kind: block.type, text, page: block.type === 'child_page' ? key : undefined,
     checked: block.type === 'to_do' ? data?.checked === true : undefined,
     image, caption: block.type === 'image' ? richText(data?.caption) : undefined,
     children: block.has_children && block.type !== 'child_page' ? await walk(key, depth + 1) : [] });
   }
   if (!list.has_more) break;
   cursor = list.next_cursor;
   if (!cursor || cursors.has(cursor) || remaining <= 0) { truncated = true; break; }
   cursors.add(cursor);
  } while (cursor);
  return result;
 }
 return { blocks: await walk(id, 0), truncated };
}
